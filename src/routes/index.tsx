import { createFileRoute } from "@tanstack/react-router";
import { DrivingApp } from "@/game/DrivingApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <DrivingApp />;
}
