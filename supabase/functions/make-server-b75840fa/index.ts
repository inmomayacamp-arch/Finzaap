import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.ts";
const app = new Hono();

app.use('*', logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get("/make-server-b75840fa/health", (c) => {
  return c.json({ status: "ok" });
});

// Get account data
app.get("/make-server-b75840fa/account/:id", async (c) => {
  const id = c.req.param("id");
  const data = await kv.get(`account:${id}`);
  return c.json({ data });
});

// Save account data
app.post("/make-server-b75840fa/account/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await kv.set(`account:${id}`, body);
  return c.json({ ok: true });
});

Deno.serve(app.fetch);
