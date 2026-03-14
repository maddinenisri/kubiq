import { useState } from "react";
import { useExtensionState } from "../../context/ExtensionStateContext";
import { TopBar } from "./TopBar";
import { TabNav } from "./TabNav";
import { ContextBar } from "./ContextBar";
import { ChatTab } from "./ChatTab";
import { ContainersTab } from "./ContainersTab";
import { LogsTab } from "./LogsTab";
import { EventsTab } from "./EventsTab";
import { DescribeTab } from "./DescribeTab";
import { YamlTab } from "./YamlTab";
import { ErrorBanner } from "../common";
import type { PodSnapshotTransfer } from "@shared/types";

const TABS = ["Chat", "Containers", "Logs", "Events", "Describe", "YAML"];

interface PodPanelProps {
  podName: string;
  namespace: string;
  context: string;
}

export function PodPanel({ podName, namespace, context }: PodPanelProps) {
  const { state, dispatch } = useExtensionState();
  const [activeTab, setActiveTab] = useState("Chat");

  const snapshot = state.snapshot as PodSnapshotTransfer | null;

  return (
    <>
      <TopBar
        podName={podName}
        namespace={namespace}
        context={context}
        phase={snapshot?.phase}
        nodeName={snapshot?.nodeName}
      />
      <TabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <ContextBar info={state.contextInfo} />

      {state.error && (
        <ErrorBanner
          message={state.error}
          onDismiss={() => dispatch({ type: "SET_ERROR", error: null })}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "Chat" && <ChatTab />}
        {activeTab === "Containers" && <ContainersTab snapshot={snapshot} />}
        {activeTab === "Logs" && <LogsTab snapshot={snapshot} />}
        {activeTab === "Events" && <EventsTab events={snapshot?.events ?? ""} />}
        {activeTab === "Describe" && <DescribeTab describe={snapshot?.describe ?? ""} />}
        {activeTab === "YAML" && <YamlTab yaml={snapshot?.yaml ?? ""} />}
      </div>
    </>
  );
}
