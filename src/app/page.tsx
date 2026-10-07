import { redirect } from "next/navigation";

// The (app) guard sends signed-out visitors on to /login.
export default function Home() {
  redirect("/dashboard");
}
