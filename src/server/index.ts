import { createRomemApp } from "./app.js";

const rootDir = process.env.ROMEM_ROOT_DIR || process.cwd();
const port = Number(process.env.PORT || 4111);

const { app } = await createRomemApp(rootDir);

app.listen(port, () => {
  console.log(`Romem server running on http://localhost:${port}`);
});
