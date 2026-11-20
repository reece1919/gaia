import test from "node:test";
import assert from "node:assert/strict";
import { describeBearerSession } from "../supabase/functions/conservatory-mcp/auth-status.mjs";
function bearer(payload) {
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return "Bearer " + [encode({alg:"ES256",typ:"JWT"}),encode(payload),"signature"].join(".");
}
test("reports AAL2 without leaking user identity",()=>{
  const result=describeBearerSession(bearer({sub:"private-user-id",email:"private@example.test",aal:"aal2",role:"authenticated"}));
  assert.deepEqual(result,{assuranceLevel:"aal2",hasSubject:true});
  assert.equal(JSON.stringify(result).includes("private"),false);
});
test("detects AAL1 clearly rather than claiming there is no history",()=>{
  assert.deepEqual(describeBearerSession(bearer({sub:"owner",aal:"aal1"})),{assuranceLevel:"aal1",hasSubject:true});
});
test("handles missing, invalid, and non-bearer credentials",()=>{
  for(const header of ["","Bearer invalid","Token invalid","Bearer a.b.c","Bearer"]) {
    assert.deepEqual(describeBearerSession(header),{assuranceLevel:"unknown",hasSubject:false});
  }
});
test("missing or unexpected AAL stays unknown",()=>{
  assert.equal(describeBearerSession(bearer({sub:"owner"})).assuranceLevel,"unknown");
  assert.equal(describeBearerSession(bearer({sub:"owner",aal:"some-other-value"})).assuranceLevel,"unknown");
});
