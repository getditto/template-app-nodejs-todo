import {
  Ditto,
  DittoError,
  Document,
  init,
  QueryResult,
  QueryResultItem,
} from "@dittolive/ditto";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "readline/promises";

let ditto: Ditto;
let taskQueryResult: QueryResult;
let attachmentQueryResult: QueryResult;
let tasks: Document[] = [];
let attachments: QueryResultItem[] = [];

// Provides the standard --help functionality on most terminal apps.
function help() {
  console.log("************* Commands *************");
  console.log("'--insert-task myNewTask'");
  console.log("'--insert-attachment myFileName'");
  console.log("   Inserts a task/attachment");
  console.log("   Inserts an attachment from ./files with the provided name.");
  console.log('   Example: "--insert-task Get Milk"');
  console.log(
    '   Example: "--insert-attachment peers.webp" adds "./files/peers.webp"',
  );
  console.log("");

  console.log("'--toggle-task myTaskTd'");
  console.log("'--toggle-attachment myAttachmentId'");
  console.log("   Toggles the isComplete property to the opposite value");
  console.log('   Example: "--toggle-task 1234abc"');
  console.log("");

  console.log("'--delete-task myTaskTd'");
  console.log("'--delete-attachment myAttachmentId'");
  console.log("   Deletes a task or attachment");
  console.log('   Example: "--delete-task 1234abc"');
  console.log("");

  console.log("--list");
  console.log("   List the current tasks and attachments");
  console.log("");

  console.log("--attachments");
  console.log("   Copy the attachments over to the ./fileOut directory.");
  console.log("");

  console.log("--exit");
  console.log("   Exits the program");

  console.log("--help");
  console.log("   prints help menu");
  console.log("************* Commands *************");
}

async function main() {
  await init();

  ditto = new Ditto({
    type: "onlinePlayground",
    appID: "REPLACE_WITH_YOUR_APP_ID",
    token: "REPLACE_WITH_YOUR_TOKEN",
  });

  await ditto.disableSyncWithV3();
  ditto.startSync();

  ditto.sync.registerSubscription(
    `
    SELECT *
    FROM tasks
    WHERE isDeleted = false
    `,
  );

  ditto.sync.registerSubscription(
    `
    SELECT *
    FROM COLLECTION attachments (my_attachment ATTACHMENT)
    WHERE isDeleted = false
    `,
  );

  ditto.store.registerObserver(
    `
    SELECT *
    FROM tasks
    WHERE isDeleted = false AND isCompleted = false
    `,
    (result) => {
      tasks = result.items.map((doc) => {
        return doc.value;
      });
    },
  );

  ditto.store.registerObserver(
    `
    SELECT *
    FROM COLLECTION attachments (my_attachment ATTACHMENT)
    WHERE isDeleted = false AND isCompleted = false
    `,
    (result) => {
      attachments = result.items;
    },
  );

  let isAskedToExit = false;

  help();

  const rl = readline.createInterface({ input, output });

  while (!isAskedToExit) {
    let answer = await rl.question("Your command:");

    // --------------------- Insert section ---------------------

    if (answer.startsWith("--insert-task")) {
      let body = answer.replace("--insert-task ", "");
      const newTask = { body, isDeleted: false, isCompleted: false };

      await ditto.store.execute(
        `
        INSERT INTO tasks
        DOCUMENTS (:newTask)
        `,
        { newTask },
      );
    }

    if (answer.startsWith("--insert-attachment")) {
      let name = answer.replace("--insert-attachment ", "");
      const metadata = { name: name };

      try {
        // Copy the file into Ditto's store and create an attachment object.
        const myAttachment = await ditto.store.newAttachment(
          "./files/" + name,
          metadata,
        );

        const newDQLAttachment = {
          name,
          isDeleted: false,
          isCompleted: false,
          my_attachment: myAttachment,
        };

        await ditto.store.execute(
          `
          INSERT INTO COLLECTION attachments (my_attachment ATTACHMENT)
          DOCUMENTS (:newDQLAttachment)
          `,
          { newDQLAttachment },
        );
      } catch (e) {
        if (
          e instanceof DittoError &&
          e.code === "store/attachment-file-not-found"
        ) {
          console.error(`File not found: ${name}`);
        } else {
          console.error("Error trying to insert attachment:");
          console.error(e);
        }
      }
    }

    // --------------------- Toggle section ---------------------

    if (answer.startsWith("--toggle-task")) {
      let id = answer.replace("--toggle-task ", "");
      taskQueryResult = await ditto.store.execute(
        `
        SELECT *
        FROM tasks
        WHERE _id = :id
        `,
        { id },
      );
      let newValue = !taskQueryResult.items.map((item) => {
        return item.value.isCompleted;
      })[0];
      await ditto.store.execute(
        `
        UPDATE tasks
        SET isCompleted = :newValue
        WHERE _id = :id
        `,
        { id, newValue },
      );
    }

    if (answer.startsWith("--toggle-attachment")) {
      let id = answer.replace("--toggle-attachment ", "");
      attachmentQueryResult = await ditto.store.execute(
        `
        SELECT *
        FROM COLLECTION attachments (my_attachment ATTACHMENT)
        WHERE _id = :id
        `,
        { id },
      );
      let newValue = !attachmentQueryResult.items.map((item) => {
        return item.value.isCompleted;
      })[0];
      await ditto.store.execute(
        `
        UPDATE COLLECTION attachments (my_attachment ATTACHMENT)
        SET isCompleted = :newValue
        WHERE _id = :id
        `,
        { id, newValue },
      );
    }

    // --------------------- Delete section ---------------------

    if (answer.startsWith("--delete-task")) {
      let id = answer.replace("--delete-task ", "");
      await ditto.store.execute(
        `
        UPDATE tasks
        SET isDeleted = true
        WHERE _id = :id
        `,
        { id },
      );
    }

    if (answer.startsWith("--delete-attachment")) {
      let id = answer.replace("--delete-attachment ", "");
      await ditto.store.execute(
        `
        UPDATE COLLECTION attachments (my_attachment ATTACHMENT)
        SET isDeleted = true
        WHERE _id = :id
        `,
        { id },
      );
    }

    // --------------------- List section ---------------------

    if (answer.startsWith("--list")) {
      console.log("Tasks:");
      console.log(tasks);
      console.log("Attachments:");
      console.log(attachments);
    }

    // --------------------- Attachments section ---------------------

    if (answer.startsWith("--attachments")) {
      // Get attachment from the observer and copy all files to the filesOut directory.
      attachments.forEach((element) => {
        try {
          const attachmentToken = element.value.my_attachment;

          ditto.store.fetchAttachment(
            attachmentToken,
            async (attachmentFetchEvent) => {
              switch (attachmentFetchEvent.type) {
                case "Completed":
                  const fetchedAttachment = attachmentFetchEvent.attachment;
                  const name = fetchedAttachment.metadata["name"];
                  fetchedAttachment.copyToPath("./filesOut/" + name);
                  console.log(
                    `Attachment fetch completed at ./filesOut/${name}`,
                  );
                  break;
                case "Progress":
                  console.log("Fetch attachment in progress");
                  break;
                case "Deleted":
                  console.log("Attachment deleted");
                  break;
              }
            },
          );
        } catch (e) {
          console.log("Error when trying to copy all attachments.");
          console.log(e);
        }
      });
    }

    // --------------------- Help section ---------------------

    if (answer.startsWith("--help")) {
      help();
    }

    // --------------------- Exit section ---------------------

    if (answer.startsWith("--exit")) {
      await ditto.close();
      process.exit();
    }
  }
}

main();
