import amqp from 'amqplib';
import { config } from '@nginz/config';

let connection: any = null;
let channel: any = null;
let connecting: Promise<{ connection: any; channel: any }> | null = null;

// Consumers survive broker restarts: they are re-subscribed whenever the connection drops
const consumers: Array<{ queueName: string; onMessage: (msg: any) => Promise<void> }> = [];
let reconnectTimer: NodeJS.Timeout | null = null;

export const connectRabbitMQ = async (customUri?: string): Promise<{ connection: any; channel: any }> => {
  if (connection && channel) {
    return { connection, channel };
  }
  if (connecting) {
    return connecting;
  }

  const uri = customUri || config.rabbitmqUri;
  console.log('[RabbitMQ] Connecting to broker...');

  connecting = (async () => {
    const conn = await amqp.connect(uri);
    const ch = await conn.createChannel();

    conn.on('error', (err: any) => {
      console.error('[RabbitMQ] Connection Error:', err.message);
    });

    conn.on('close', () => {
      console.warn('[RabbitMQ] Connection closed');
      connection = null;
      channel = null;
      scheduleResubscribe();
    });

    // A channel can close on its own (e.g. a protocol error); recycle the connection so everything reconnects cleanly
    ch.on('error', (err: any) => console.error('[RabbitMQ] Channel Error:', err.message));
    ch.on('close', () => {
      if (channel === ch) {
        channel = null;
        conn.close().catch(() => {});
      }
    });

    connection = conn;
    channel = ch;
    console.log('[RabbitMQ] Connected successfully');
    return { connection, channel };
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
};

export const getRabbitChannel = (): any => {
  if (!channel) {
    throw new Error('[RabbitMQ] Channel not initialized. Call connectRabbitMQ() first.');
  }
  return channel;
};

export const publishMessage = async (
  exchange: string,
  routingKey: string,
  message: any
): Promise<boolean> => {
  const { channel: ch } = await connectRabbitMQ();
  await ch.assertExchange(exchange, 'direct', { durable: true });
  const payload = Buffer.from(JSON.stringify(message));
  return ch.publish(exchange, routingKey, payload, { persistent: true });
};

export const publishToQueue = async (queueName: string, message: any): Promise<boolean> => {
  const { channel: ch } = await connectRabbitMQ();
  await ch.assertQueue(queueName, { durable: true });
  const payload = Buffer.from(JSON.stringify(message));
  return ch.sendToQueue(queueName, payload, { persistent: true });
};

const subscribe = async (queueName: string, onMessage: (msg: any) => Promise<void>): Promise<void> => {
  const { channel: ch } = await connectRabbitMQ();
  await ch.assertQueue(queueName, { durable: true });
  const deadLetterQueue = `${queueName}.dead`;
  await ch.assertQueue(deadLetterQueue, { durable: true });
  ch.consume(queueName, async (raw: any) => {
    if (raw) {
      try {
        const parsed = JSON.parse(raw.content.toString());
        await onMessage(parsed);
        ch.ack(raw);
      } catch (err: any) {
        // Keep failed jobs for inspection/replay instead of discarding them
        try {
          ch.sendToQueue(deadLetterQueue, raw.content, {
            persistent: true,
            headers: { 'x-error': String(err?.message ?? err), 'x-failed-at': new Date().toISOString() },
          });
          ch.ack(raw);
        } catch {
          ch.nack(raw, false, true);
        }
      }
    }
  });
};

const scheduleResubscribe = (attempt = 1): void => {
  if (consumers.length === 0 || reconnectTimer) return;
  const delayMs = Math.min(1000 * attempt, 10000);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      for (const { queueName, onMessage } of consumers) {
        await subscribe(queueName, onMessage);
      }
      console.log(`[RabbitMQ] Re-subscribed ${consumers.length} consumer(s) after reconnect`);
    } catch (err: any) {
      console.error(`[RabbitMQ] Reconnect attempt ${attempt} failed: ${err.message}`);
      scheduleResubscribe(attempt + 1);
    }
  }, delayMs);
};

export const consumeFromQueue = async (
  queueName: string,
  onMessage: (msg: any) => Promise<void>
): Promise<void> => {
  consumers.push({ queueName, onMessage });
  try {
    await subscribe(queueName, onMessage);
  } catch (err: any) {
    // Broker not reachable yet: keep retrying in the background rather than giving up
    console.error(`[RabbitMQ] Initial subscribe to ${queueName} failed: ${err.message}`);
    scheduleResubscribe();
  }
};

export const closeRabbitMQ = async (): Promise<void> => {
  consumers.length = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (channel) {
    try { await channel.close(); } catch {}
    channel = null;
  }
  if (connection) {
    try { await connection.close(); } catch {}
    connection = null;
  }
};
