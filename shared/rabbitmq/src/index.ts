import amqp from 'amqplib';
import { config } from '@nginz/config';

let connection: any = null;
let channel: any = null;

export const connectRabbitMQ = async (customUri?: string): Promise<{ connection: any; channel: any }> => {
  if (connection && channel) {
    return { connection, channel };
  }

  const uri = customUri || config.rabbitmqUri;
  console.log('[RabbitMQ] Connecting to broker...');
  
  const conn = await amqp.connect(uri);
  const ch = await conn.createChannel();

  connection = conn;
  channel = ch;

  conn.on('error', (err: any) => {
    console.error('[RabbitMQ] Connection Error:', err.message);
  });

  conn.on('close', () => {
    console.warn('[RabbitMQ] Connection closed');
    connection = null;
    channel = null;
  });

  console.log('[RabbitMQ] Connected successfully');
  return { connection, channel };
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

export const consumeFromQueue = async (
  queueName: string,
  onMessage: (msg: any) => Promise<void>
): Promise<void> => {
  const { channel: ch } = await connectRabbitMQ();
  await ch.assertQueue(queueName, { durable: true });
  ch.consume(queueName, async (raw: any) => {
    if (raw) {
      try {
        const parsed = JSON.parse(raw.content.toString());
        await onMessage(parsed);
        ch.ack(raw);
      } catch (err) {
        ch.nack(raw, false, false);
      }
    }
  });
};

export const closeRabbitMQ = async (): Promise<void> => {
  if (channel) {
    try { await channel.close(); } catch {}
    channel = null;
  }
  if (connection) {
    try { await connection.close(); } catch {}
    connection = null;
  }
};
