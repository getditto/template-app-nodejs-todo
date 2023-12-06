"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const dist_1 = require("dist");
const readline = __importStar(require("readline/promises"));
const node_process_1 = require("node:process");
let ditto;
let subscription;
let liveQuery;
let tasks = [];
let utasks = {};
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, dist_1.init)();
        ditto = new dist_1.Ditto({
            type: 'onlinePlayground',
            appID: 'f0862187-a16f-42c3-848e-48e1bb2d216a',
            token: '334e0eab-16b0-4f59-af80-4ff79ffb1aa8'
        });
        ditto.startSync();
        subscription = ditto.store.collection("tasks").find("isDeleted == false").subscribe();
        liveQuery = ditto.store.collection("tasks").find("isDeleted == false").observeLocal((docs, event) => {
            tasks = docs;
        });
        ditto.store.registerObserver(`
    SELECT *
    FROM tasks
    WHERE isDeleted = false`, (result) => { utasks = result.items; });
        let isAskedToExit = false;
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
        const rl = readline.createInterface({ input: node_process_1.stdin, output: node_process_1.stdout });
        while (!isAskedToExit) {
            let answer = yield rl.question('Your command:');
            if (answer.startsWith("--insert")) {
                let body = answer.replace("--insert ", "");
                const newTask = {
                    body,
                    isDeleted: false,
                    isCompleted: false
                };
                yield ditto.store.execute(`
          INSERT INTO tasks
          DOCUMENTS (:newTask)`, { newTask });
            }
            if (answer.startsWith("--toggle")) {
                let id = answer.replace("--toggle ", "");
                ditto.store.collection("tasks")
                    .findByID(id).update((doc) => {
                    let isCompleted = doc.value.isCompleted;
                    doc.at("isCompleted").set(!isCompleted);
                });
            }
            if (answer.startsWith("--list")) {
                console.log(tasks.map((task) => task.value));
            }
            if (answer.startsWith("--ulist")) {
                console.log('utasks: ', utasks);
            }
            if (answer.startsWith("--delete")) {
                let id = answer.replace("--delete ", "");
                /*
                ditto.store.collection("tasks")
                .findByID(id).update((doc) => {
                  doc.at("isDeleted").set(true)
                })
                */
                yield ditto.store.execute(`
          UPDATE tasks
          SET isDeleted = true
          WHERE _id = :id`, { id });
            }
            if (answer.startsWith("--exit")) {
                ditto.stopSync();
                process.exit();
            }
        }
    });
}
main();
/*
ditto = new Ditto({
  type: 'onlinePlayground',
  appID: 'YOUR_APP_ID',
  token: 'YOUR_TOKEN'
})
*/
