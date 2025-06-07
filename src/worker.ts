import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  const connection = await NativeConnection.connect({ address: temporalAddress });
  
  const worker = await Worker.create({
    connection,
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: 'minesweeper-task-queue',
  });

  console.log(`Worker started, connected to Temporal at: ${temporalAddress}`);
  console.log('Listening on task queue: minesweeper-task-queue');
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
}); 