/* In-memory DOM regression for inbox composition. No authenticated writes or browser API. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const rootDir=path.resolve(__dirname,"..");
class Node {
 constructor(tag="div",id="",cls=""){
  this.tagName=tag;this.id=id;this.className=cls;this.childNodes=[];this.parentElement=null;
  this.dataset={};this.attrs={};this.listeners={};this.hidden=false;this.open=false;
  this.textContent="";this.tabIndex=0;
 }
 appendChild(node){if(node.parentElement){const siblings=node.parentElement.childNodes;const index=siblings.indexOf(node);if(index>=0)siblings.splice(index,1);}
  node.parentElement=this;this.childNodes.push(node);return node;}
 append(...nodes){for(const node of nodes)this.appendChild(node);}
 replaceChildren(...nodes){for(const child of this.childNodes)child.parentElement=null;this.childNodes=[];this.append(...nodes);}
 setAttribute(key,val){this.attrs[key]=String(val);}
 removeAttribute(key){delete this.attrs[key];}
 getAttribute(key){return this.attrs[key]??null;}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 fire(name,event={}){for(const fn of this.listeners[name]||[])fn(event);}
 focus(){this.focused=true;}
 get lastChild(){return this.childNodes[this.childNodes.length-1]||null;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 querySelectorAll(selector){
  const matches=n=>selector.startsWith("#")?n.id===selector.slice(1):
    selector.startsWith(".")?n.className.split(/\s+/).includes(selector.slice(1)):
    n.tagName===selector;
  const found=[];for(const node of this.childNodes){if(matches(node))found.push(node);found.push(...node.querySelectorAll(selector));}
  return found;
 }
}
const docRoot=new Node("main");
const inbox=new Node("details","gaia-tasks");
const summary=new Node("summary");
const title=new Node("span","","gaia-task-summary-title");
title.appendChild(new Node("span"));
summary.appendChild(title);
summary.appendChild(new Node("span","gaia-task-progress"));
inbox.appendChild(summary);
const content=new Node("div","","gaia-task-content");
const todoist=new Node("div","","gaia-unified-todoist");
const system=new Node("section","","system-todoist");
system.appendChild(new Node("div","","system-todoist-list"));
todoist.appendChild(system);
const checklist=new Node("details","gaia-checklist-section");
checklist.hidden=true;checklist.setAttribute("aria-hidden","true");
const list=new Node("div","gaia-task-list");
const row=new Node("article","","gaia-task-item");
list.appendChild(row);
checklist.append(new Node("summary"),new Node("p"),list);
const priorities=new Node("div","","gaia-unified-priorities");
content.append(todoist,checklist,priorities);
inbox.appendChild(content);
const approvals=new Node("section","gaia-task-approvals");
const proposalList=new Node("div","gaia-task-queue-content");
const proposal=new Node("button");proposal.setAttribute("data-gaia-approve","test");
proposalList.appendChild(proposal);
approvals.append(new Node("h2"),new Node("p"),proposalList);
docRoot.append(inbox,approvals);
const document={
 getElementById:id=>docRoot.querySelector("#"+id),
 createElement:tag=>new Node(tag),
 createTextNode:text=>Object.assign(new Node("#text"),{nodeType:3,textContent:text}),
 addEventListener:(name,fn)=>{(document.listeners[name]??=[]).push(fn)},
 listeners:{}
};
vm.runInNewContext(fs.readFileSync(path.join(rootDir,"daily-care-inbox.js"),"utf8"),
 {document,window:{GAIA_CLOUD:{user:{id:"owner"}}}},{filename:"daily-care-inbox.js"});
test("Original task sources are moved exactly once into one inbox",()=>{
 assert.equal(content.querySelector(".gaia-unified-todoist"),todoist);
 assert.equal(content.querySelector("#gaia-checklist-section"),checklist);
 assert.equal(content.querySelector("#gaia-task-approvals"),approvals);
 assert.equal(content.querySelector(".gaia-unified-priorities"),priorities);
 assert.equal(docRoot.childNodes.length,1,"No separate approval section remains below the collection");
 assert.equal(checklist.hidden,false);
 assert.equal(checklist.getAttribute("aria-hidden"),null);
 assert.equal(inbox.open,true);
 assert.equal(document.getElementById("gaia-task-progress").hidden,false);
 assert.equal(content.querySelectorAll(".gaia-inbox-tabs").length,1);
});
test("Do, Decide and Monitor tabs preserve their original interactive controls",()=>{
 const doButton=document.getElementById("gaia-inbox-tab-do");
 const decideButton=document.getElementById("gaia-inbox-tab-decide");
 const decidePanel=document.getElementById("gaia-inbox-panel-decide");
 const doPanel=document.getElementById("gaia-inbox-panel-do");
 assert.equal(doPanel.hidden,false);assert.equal(decidePanel.hidden,true);
 decideButton.fire("click");
 assert.equal(doPanel.hidden,true);assert.equal(decidePanel.hidden,false);
 assert.equal(decideButton.getAttribute("aria-selected"),"true");
 assert.equal(decidePanel.querySelector("#gaia-task-queue-content"),proposalList);
 doButton.fire("click");
 assert.equal(doPanel.hidden,false);assert.equal(decidePanel.hidden,true);
 assert.equal(doPanel.querySelector("#gaia-task-list"),list);
});
test("Inbox remains read-only composition with owner actions handled in their existing modules",()=>{
 const js=fs.readFileSync(path.join(rootDir,"daily-care-inbox.js"),"utf8");
 const html=fs.readFileSync(path.join(rootDir,"index.html"),"utf8");
 assert.doesNotMatch(js,/\.from\(|fetch\(|\.upsert\(|\.delete\(/);
 assert.ok(html.indexOf('src="daily-care-inbox.js')>html.indexOf('src="compact-shell.js'));
 assert.ok(html.includes('href="daily-care-inbox.css'));
});
