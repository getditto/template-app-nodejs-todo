import { init, Ditto, Document } from '@dittolive/ditto'
import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'node:process';

let ditto
let tasks: Document[] = []
let queryResult

async function main () {
  await init()

  ditto = new Ditto({
    type: 'onlinePlayground',
    appID: 'REPLACE_WITH_YOUR_APP_ID',
    token: 'REPLACE_WITH_YOUR_TOKEN'
  })
  ditto.startSync()

  ditto.sync.registerSubscription(`
    SELECT *
    FROM tasks
    WHERE isDeleted = false`
  )
  ditto.store.registerObserver(`
    SELECT *
    FROM tasks
    WHERE isDeleted = false AND isCompleted = false`,
    (result) => {
       tasks = result.items
        .map((doc) => {
          return doc.value
        })
    }
  )
  let isAskedToExit = false
  
  console.log("************* Commands *************");
  console.log("--insert my new task");
  console.log("   Inserts a task");
  console.log("   Example: \"--insert Get Milk\"");
  console.log("--toggle myTaskTd");
  console.log("   Toggles the isComplete property to the opposite value");
  console.log("   Example: \"--toggle 1234abc\"");
  console.log("--delete myTaskTd");
  console.log("   Deletes a task");
  console.log("   Example: \"--delete 1234abc\"");
  console.log("--list");
  console.log("   List the current tasks");
  console.log("--exit");
  console.log("   Exits the program");
  console.log("************* Commands *************");

  const rl = readline.createInterface({ input, output });
  while (!isAskedToExit) {

      let answer = await rl.question('Your command:')
      if (answer.startsWith("--insert")) {
        let body = answer.replace("--insert ", "")
        const newTask = {
          body,
          isDeleted: false,
          isCompleted: false
        }
        await ditto.store.execute(`
          INSERT INTO tasks
          DOCUMENTS (:newTask)`,
          { newTask })
      }
      if (answer.startsWith("--toggle")) {
        let id = answer.replace("--toggle ", "")
        queryResult = await ditto.store.execute(`
          SELECT * FROM tasks
          WHERE _id = :id`,
          { id }
        )
        let newValue = !queryResult.items
        .map((item) => {
          return item.value.isCompleted
        })[0]
        await ditto.store.execute(`
          UPDATE tasks
          SET isCompleted = :newValue
          WHERE _id = :id`,
          { id, newValue }
        )
      }
      if (answer.startsWith("--list")) {
        console.log(tasks)
      }
      if (answer.startsWith("--delete")) {
        let id = answer.replace("--delete ", "")
        await ditto.store.execute(`
          UPDATE tasks
          SET isDeleted = true
          WHERE _id = :id`,
          { id }
        )
      }
      if (answer.startsWith("--exit")) {
        ditto.stopSync()
        process.exit()
      }
  }
}

main()
