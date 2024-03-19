import {
  Ditto,
  DittoError,
  init,
  QueryResult,
  QueryResultItem,
} from "@dittolive/ditto";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "readline/promises";

let ditto: Ditto;
let taskQueryResult: QueryResult;
let tasks: QueryResultItem[] = [];

// Provides the standard --help functionality on most terminal apps.
function help() {
  console.log("************* Commands *************");
  console.log("'insert myNewTaskName'");
  console.log("   Inserts a task");
  console.log('   Example: "insert Get Milk"');
  console.log("");

  console.log("'update-attachment myTaskId myFileName'");
  console.log(
    "   Updats the task with the attachment from ./files with the provided name.",
  );
  console.log(
    '   Example: "update-attachment 1234abc peers.webp" adds ./files/peers.webp to task 65f0691b00a14c9100b02f03',
  );
  console.log("");

  console.log("'toggle myTaskId'");
  console.log("   Toggles the isComplete property to the opposite value");
  console.log('   Example: "toggle 1234abc"');
  console.log("");

  console.log("'delete myTaskTd'");
  console.log("   Deletes a task");
  console.log('   Example: "delete 1234abc"');
  console.log("");

  console.log("list");
  console.log("   List the current tasks and attachments");
  console.log("");

  console.log("attachments");
  console.log("   Copy the attachments over to the ./fileOut directory.");
  console.log('   Example: "attachments"');
  console.log("");

  console.log("exit");
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
    FROM COLLECTION tasks (my_attachment ATTACHMENT)
    WHERE isDeleted = false
    `,
  );

  ditto.store.registerObserver(
    `
    SELECT *
    FROM COLLECTION tasks (my_attachment ATTACHMENT)
    WHERE isDeleted = false AND isCompleted = false
    `,
    (result) => {
      tasks = result.items;
    },
  );

  let isAskedToExit = false;

  help();

  const rl = readline.createInterface({ input, output });

  while (!isAskedToExit) {
    let answer = await rl.question("Your command:");

    // --------------------- Insert section ---------------------

    if (answer.startsWith("insert")) {
      let body = answer.replace("insert ", "");
      const newTask = { body, isDeleted: false, isCompleted: false };

      await ditto.store.execute(
        `
        INSERT INTO COLLECTION tasks (my_attachment ATTACHMENT)
        DOCUMENTS (:newTask)
        `,
        { newTask },
      );
    }

    if (answer.startsWith("update-attachment")) {
      let body = answer.replace("update-attachment ", "");
      let args = body.split(" ", 2);
      let id = args[0];
      let name = args[1];

      const metadata = { name: name };

      try {
        // Copy the file into Ditto's store and create an attachment object.
        const myAttachment = await ditto.store.newAttachment(
          "./files/" + name,
          metadata,
        );

        await ditto.store.execute(
          `
          UPDATE COLLECTION tasks (my_attachment ATTACHMENT)
          SET my_attachment = :myAttachment
          WHERE _id = :id
          `,
          { id, myAttachment },
        );
      } catch (e) {
        if (
          e instanceof DittoError &&
          e.code === "store/attachment-file-not-found"
        ) {
          console.error(`File not found: ${name}`);
        } else {
          console.error("Error trying to update attachment:");
          console.error(e);
        }
      }
    }

    // --------------------- Toggle section ---------------------

    if (answer.startsWith("toggle")) {
      let id = answer.replace("toggle ", "");
      taskQueryResult = await ditto.store.execute(
        `
        SELECT *
        FROM COLLECTION tasks (my_attachment ATTACHMENT)
        WHERE _id = :id
        `,
        { id },
      );
      let newValue = !taskQueryResult.items.map((item) => {
        return item.value.isCompleted;
      })[0];
      await ditto.store.execute(
        `
        UPDATE COLLECTION tasks (my_attachment ATTACHMENT)
        SET isCompleted = :newValue
        WHERE _id = :id
        `,
        { id, newValue },
      );
    }

    // --------------------- Delete section ---------------------

    if (answer.startsWith("delete")) {
      let id = answer.replace("delete ", "");
      await ditto.store.execute(
        `
        UPDATE COLLECTION tasks (my_attachment ATTACHMENT)
        SET isDeleted = true
        WHERE _id = :id
        `,
        { id },
      );
    }

    // --------------------- List section ---------------------

    if (answer.startsWith("list")) {
      console.log("Tasks:");
      console.log(tasks);
    }

    // --------------------- Attachments section ---------------------

    if (answer.startsWith("attachments")) {
      // Get attachment from the observer and copy all files to the filesOut directory.
      // This can be done with await ditto.store.execute() on the collection as well.
      tasks.forEach((element) => {
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

    if (answer.startsWith("exit")) {
      await ditto.close();
      process.exit();
    }
  }
}

main();
