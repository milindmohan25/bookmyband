import { createFileRoute } from "@tanstack/react-router";
import { getBands } from "../lib/catalog.functions";
import BookMyBand from "../App.jsx";

export const Route = createFileRoute("/")({
  loader: async () => getBands(),
  component: Home,
});

function Home() {
  const { bands, live } = Route.useLoaderData();
  return <BookMyBand bands={bands} catalogLive={live} />;
}
