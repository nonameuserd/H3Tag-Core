import app from "./app";
import config from "@h3tag-blockchain/shared/dist/utils/config";

const PORT = config.network.port || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
