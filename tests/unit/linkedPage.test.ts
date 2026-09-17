import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateAddress, htmlToText, looksLikeLogin, needsLoginByHost, readLinkedPage } from "../../src/lib/linkedPage";

test("internal addresses are refused, public ones allowed", () => {
  for (const ip of ["127.0.0.1", "10.2.3.4", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.100.1.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.ok(isPrivateAddress(ip), ip);
  }
  for (const ip of ["8.8.8.8", "104.21.3.4", "2606:4700::1111"]) assert.ok(!isPrivateAddress(ip), ip);
});

test("a card pointing at the server itself is never fetched", async () => {
  for (const u of ["http://127.0.0.1:80/", "http://localhost/", "http://169.254.169.254/latest/meta-data/", "file:///etc/passwd", "http://user:pw@example.com/"]) {
    const p = await readLinkedPage(u);
    assert.equal(p.status, "unreadable", u);
  }
});

test("sites that need the user's own session are known without asking", () => {
  assert.ok(needsLoginByHost("https://mail.google.com/mail/u/0/#inbox/abc"));
  assert.ok(needsLoginByHost("https://eu.app.harvey.ai/x"));
  assert.ok(needsLoginByHost("https://chatgpt.com/c/123"));
  assert.ok(!needsLoginByHost("https://indiankanoon.org/doc/1/"));
});

test("html becomes readable text, without scripts or styles", () => {
  const { title, text } = htmlToText(
    "<html><head><title>Order &amp; Judgment</title><style>p{}</style></head><body><script>var x=1</script><p>Termination was&nbsp;invalid.</p><p>Costs &#8377;5000</p></body></html>"
  );
  assert.equal(title, "Order & Judgment");
  assert.equal(text, "Termination was invalid.\nCosts ₹5000");
});

test("a sign-in wall is recognised, a long public page with a login box is not", () => {
  assert.ok(looksLikeLogin('<form><input type="password"></form>', "Sign in to continue"));
  const long = "Judgment text. ".repeat(400);
  assert.ok(!looksLikeLogin(`<div hidden><input type=password></div><p>${long}</p>`, long));
});
