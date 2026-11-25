import { App } from "@/components/App";
import { LangProvider } from "@/components/LangProvider";

export default function Page() {
  return (
    <LangProvider>
      <App />
    </LangProvider>
  );
}
