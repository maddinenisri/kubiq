import { FilterBar } from "./FilterBar";
import { StatusBar } from "./StatusBar";
import { ResourceTabs } from "./ResourceTabs";
import { ResourceView } from "./ResourceView";

export function Sidebar() {
  return (
    <>
      <FilterBar />
      <StatusBar />
      <ResourceTabs />
      <ResourceView />
    </>
  );
}
