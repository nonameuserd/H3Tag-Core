import app from "./app";
import { defaultConfig } from "@h3tag-blockchain/shared";

const PORT = defaultConfig.network.port || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
