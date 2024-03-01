import { init, Ditto, Document, QueryResultItem } from "@dittolive/ditto";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "node:process";

let ditto;
let tasks: Document[] = [];
// Attachments dont seem to show up as part of a document. Using Query item instead.
let attachments: QueryResultItem[] = [];
let queryResult;

async function main() {
  await init();

  ditto = new Ditto({
    type: "onlinePlayground",
    appID: "REPLACE_WITH_YOUR_APP_ID",
    token: "REPLACE_WITH_YOUR_TOKEN",
  });
  ditto.startSync();

  ditto.sync.registerSubscription(
    `SELECT * FROM tasks WHERE isDeleted = false`,
  );

  ditto.sync.registerSubscription(
    `SELECT * FROM COLLECTION attachments (my_attachment ATTACHMENT) WHERE isDeleted = false`,
  );

  ditto.store.registerObserver(
    `SELECT * FROM tasks WHERE isDeleted = false AND isCompleted = false`,
    (result) => {
      tasks = result.items.map((doc) => {
        return doc.value;
      });
    },
  );

  ditto.store.registerObserver(
    "SELECT * FROM COLLECTION attachments (my_attachment ATTACHMENT) WHERE isDeleted = false AND isCompleted = false",
    (result) => {
      attachments = result.items;
      // Attachments dont seem to show up as part of a document
      //   .map((doc) => {
      //   return doc.value;
      // });
    },
  );

  let isAskedToExit = false;

  console.log("************* Commands *************");
  console.log("--insert my new task");
  console.log("   Inserts a task");
  console.log('   Example: "--insert Get Milk"');
  console.log("--toggle myTaskTd");
  console.log("   Toggles the isComplete property to the opposite value");
  console.log('   Example: "--toggle 1234abc"');
  console.log("--delete myTaskTd");
  console.log("   Deletes a task");
  console.log('   Example: "--delete 1234abc"');
  console.log("--list");
  console.log("   List the current tasks");
  console.log("--add path_to_attachment");
  console.log("   adds an attachment from the path to the file.");
  console.log('   Example: "--insert Get Milk"');
  console.log("--attachments");
  console.log("   List the current attachments");
  console.log("--exit");
  console.log("   Exits the program");
  console.log("************* Commands *************");

  const rl = readline.createInterface({ input, output });

  while (!isAskedToExit) {
    let answer = await rl.question("Your command:");

    if (answer.startsWith("--insert")) {
      let body = answer.replace("--insert ", "");
      const newTask = { body, isDeleted: false, isCompleted: false };

      await ditto.store.execute(`INSERT INTO tasks DOCUMENTS (:newTask)`, {
        newTask,
      });
    }

    if (answer.startsWith("--add")) {
      let path = answer.replace("--add ", "");
      const metadata = { name: "image.png" };

      // Copy the file into Ditto's store and create an attachment object.
      const myAttachment = await ditto.store.newAttachment(path, metadata);
      console.log(myAttachment);

      const newDQLAttachment = {
        path,
        isDeleted: false,
        isCompleted: false,
        my_attachment: myAttachment,
      };

      // Insert the document into the collection, marking `my_attachment` as an
      // attachment field.
      await ditto.store.execute(
        `INSERT INTO COLLECTION attachments (my_attachment ATTACHMENT)
             DOCUMENTS (:newDQLAttachment)`,
        { newDQLAttachment },
      );
    }

    if (answer.startsWith("--toggle")) {
      let id = answer.replace("--toggle ", "");
      queryResult = await ditto.store.execute(
        `SELECT * FROM tasks WHERE _id = :id`,
        { id },
      );
      let newValue = !queryResult.items.map((item) => {
        return item.value.isCompleted;
      })[0];
      await ditto.store.execute(
        `UPDATE tasks SET isCompleted = :newValue  WHERE _id = :id`,
        { id, newValue },
      );
    }

    if (answer.startsWith("--list")) {
      console.log(tasks);
    }

    if (answer.startsWith("--attachments")) {
      // Fetch the attachment token from a document in the store
      // is you want to search by ID: "WHERE _id = '123'" syntax is very important single quote only.
      const result = await ditto.store.execute(
        `
           SELECT *
           FROM COLLECTION attachments (my_attachment ATTACHMENT)`,
      );
      console.log("Result from execute:");
      console.log(result);

      const token = result.items[0].value.my_attachment;
      const attachment = await ditto.store.fetchAttachment(token);
      const attachmentData = await attachment.data();

      console.log("First attachments data:");
      console.log(attachmentData);

      // Get attchment from the observer.
      console.log("Result from observer:");
      console.log(attachments);
      const token_Array = attachments[0].value.my_attachment;
      const attachment_Array = await ditto.store.fetchAttachment(token_Array);
      const attachmentDataFromArray = await attachment_Array.data();

      console.log("First attachments data from observer:");
      console.log(attachmentDataFromArray);
    }

    if (answer.startsWith("--delete")) {
      let id = answer.replace("--delete ", "");
      await ditto.store.execute(
        `UPDATE tasks SET isDeleted = true WHERE _id = :id`,
        { id },
      );
    }

    if (answer.startsWith("--exit")) {
      ditto.stopSync();
      process.exit();
    }
  }
}

main();
