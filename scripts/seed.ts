import data from "../data/emails.json";
import { EmailSchema } from "../src/types";

const result = EmailSchema.array().safeParse(data);

if (!result.success) {  
  console.error("Validation failed:");
  console.error(result.error.format());
} else {
  console.log("All emails valid");
}