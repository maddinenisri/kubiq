import { useExtensionState } from "../../context/ExtensionStateContext";
import { LoadingSpinner, ErrorBanner } from "../common";
import { PodsTable } from "./tables/PodsTable";
import { DeploymentsTable } from "./tables/DeploymentsTable";
import { ServicesTable } from "./tables/ServicesTable";
import { ConfigMapsTable } from "./tables/ConfigMapsTable";
import { NodesTable } from "./tables/NodesTable";
import { EventsTable } from "./tables/EventsTable";
import type { PodRow, DeployRow, ServiceRow, ConfigMapRow, NodeRow, EventRow } from "@shared/types";

export function ResourceView() {
  const { state, dispatch } = useExtensionState();

  if (state.error) {
    return <ErrorBanner message={state.error} onDismiss={() => dispatch({ type: "SET_ERROR", error: null })} />;
  }

  if (state.loading) {
    return <LoadingSpinner message={`Fetching ${state.currentResource}…`} />;
  }

  if (!state.currentContext) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 p-5 text-center text-dim">
        <div className="text-3xl text-accent/60">⬡</div>
        <div className="text-sm font-semibold text-text">Kubiq</div>
        <div className="text-sm leading-relaxed">
          Select a profile and cluster
          <br />
          to start exploring
        </div>
      </div>
    );
  }

  const rows = state.data[state.currentResource];
  if (!rows) {
    return <LoadingSpinner message={`Fetching ${state.currentResource}…`} />;
  }

  switch (state.currentResource) {
    case "pods":
      return <PodsTable rows={rows as PodRow[]} />;
    case "deployments":
      return <DeploymentsTable rows={rows as DeployRow[]} />;
    case "services":
      return <ServicesTable rows={rows as ServiceRow[]} />;
    case "configmaps":
      return <ConfigMapsTable rows={rows as ConfigMapRow[]} />;
    case "nodes":
      return <NodesTable rows={rows as NodeRow[]} />;
    case "events":
      return <EventsTable rows={rows as EventRow[]} />;
    default:
      return null;
  }
}
