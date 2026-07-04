import { redirect } from "next/navigation";

/** Root → dashboard. */
export default function Home() {
  redirect("/dashboard");
}
