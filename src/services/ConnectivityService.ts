/**
 * Service connectivity debugger — runs sequential diagnostic checks
 * to identify why a pod can't reach a target service.
 */

import { runner } from "./KubectlService";

export interface ConnectivityCheck {
  name: string;
  status: "pass" | "fail" | "warn" | "running" | "pending";
  message: string;
  details?: string;
}

export interface ConnectivityResult {
  sourcePod: string;
  sourceNamespace: string;
  targetService: string;
  targetNamespace: string;
  checks: ConnectivityCheck[];
  summary: string;
}

export async function testConnectivity(
  context: string,
  sourcePod: string,
  sourceNamespace: string,
  targetService: string,
  targetNamespace: string,
  onProgress: (checks: ConnectivityCheck[]) => void,
): Promise<ConnectivityResult> {
  const checks: ConnectivityCheck[] = [
    { name: "Service Exists", status: "pending", message: "" },
    { name: "Endpoints Health", status: "pending", message: "" },
    { name: "Target Pods Ready", status: "pending", message: "" },
    { name: "NetworkPolicy", status: "pending", message: "" },
    { name: "DNS Resolution", status: "pending", message: "" },
  ];

  const update = (idx: number, check: Partial<ConnectivityCheck>) => {
    checks[idx] = { ...checks[idx], ...check };
    onProgress([...checks]);
  };

  let clusterIP: string;
  let servicePort: string;
  let selector: Record<string, string>;

  // Check 1: Service Exists
  update(0, { status: "running" });
  try {
    const raw = await runner.run(
      [
        "get",
        "service",
        targetService,
        "-o",
        "json",
        `--namespace=${targetNamespace}`,
        `--context=${context}`,
      ],
      context,
    );
    const svc = JSON.parse(raw);
    const spec = svc.spec as Record<string, unknown>;
    clusterIP = (spec.clusterIP as string) ?? "";
    const ports = (spec.ports as Array<Record<string, unknown>>) ?? [];
    servicePort = ports.length > 0 ? `${ports[0].port}/${ports[0].protocol}` : "";
    selector = (spec.selector as Record<string, string>) ?? {};

    update(0, {
      status: "pass",
      message: `Service found — ${spec.type} ${clusterIP}`,
      details: `Port: ${servicePort}  Selector: ${Object.entries(selector)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    });
  } catch (e) {
    update(0, {
      status: "fail",
      message: `Service '${targetService}' not found in namespace '${targetNamespace}'`,
      details: (e as Error).message,
    });
    return buildResult(sourcePod, sourceNamespace, targetService, targetNamespace, checks);
  }

  // Check 2: Endpoints Health
  update(1, { status: "running" });
  try {
    const raw = await runner.run(
      [
        "get",
        "endpoints",
        targetService,
        "-o",
        "json",
        `--namespace=${targetNamespace}`,
        `--context=${context}`,
      ],
      context,
    );
    const ep = JSON.parse(raw);
    const subsets = (ep.subsets as Array<Record<string, unknown>>) ?? [];
    const addresses = subsets.flatMap((s) => (s.addresses as Array<Record<string, unknown>>) ?? []);
    const notReady = subsets.flatMap(
      (s) => (s.notReadyAddresses as Array<Record<string, unknown>>) ?? [],
    );

    if (addresses.length > 0) {
      update(1, {
        status: "pass",
        message: `${addresses.length} healthy endpoint${addresses.length > 1 ? "s" : ""}`,
        details: addresses.map((a) => a.ip as string).join(", "),
      });
    } else if (notReady.length > 0) {
      update(1, {
        status: "warn",
        message: `${notReady.length} endpoint${notReady.length > 1 ? "s" : ""} not ready`,
        details: "Pods exist but readiness probe is failing",
      });
    } else {
      update(1, {
        status: "fail",
        message: "No endpoints — selector doesn't match any pods",
        details: `Selector: ${Object.entries(selector)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`,
      });
    }
  } catch {
    update(1, { status: "fail", message: "Could not fetch endpoints" });
  }

  // Check 3: Target Pods Ready
  update(2, { status: "running" });
  try {
    const labelSelector = Object.entries(selector)
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    if (labelSelector) {
      const raw = await runner.run(
        [
          "get",
          "pods",
          "-l",
          labelSelector,
          "-o",
          "json",
          `--namespace=${targetNamespace}`,
          `--context=${context}`,
        ],
        context,
      );
      const pods = JSON.parse(raw);
      const items = (pods.items as Array<Record<string, unknown>>) ?? [];
      const ready = items.filter((p) => {
        const status = p.status as Record<string, unknown>;
        const cs = (status.containerStatuses as Array<Record<string, unknown>>) ?? [];
        return cs.every((c) => c.ready);
      });

      if (items.length === 0) {
        update(2, { status: "fail", message: `No pods match selector: ${labelSelector}` });
      } else if (ready.length === items.length) {
        update(2, { status: "pass", message: `${ready.length}/${items.length} pods ready` });
      } else {
        update(2, {
          status: "warn",
          message: `${ready.length}/${items.length} pods ready`,
          details: `${items.length - ready.length} pod${items.length - ready.length > 1 ? "s" : ""} not ready`,
        });
      }
    } else {
      update(2, { status: "warn", message: "No selector on service — can't verify target pods" });
    }
  } catch {
    update(2, { status: "warn", message: "Could not check target pods" });
  }

  // Check 4: NetworkPolicy
  update(3, { status: "running" });
  try {
    const [srcNpRaw, tgtNpRaw] = await Promise.all([
      runner.runSafe(
        [
          "get",
          "networkpolicy",
          "-o",
          "json",
          `--namespace=${sourceNamespace}`,
          `--context=${context}`,
        ],
        context,
      ),
      runner.runSafe(
        [
          "get",
          "networkpolicy",
          "-o",
          "json",
          `--namespace=${targetNamespace}`,
          `--context=${context}`,
        ],
        context,
      ),
    ]);

    let srcCount = 0;
    let tgtCount = 0;
    try {
      srcCount = (JSON.parse(srcNpRaw).items as unknown[])?.length ?? 0;
    } catch {
      /* */
    }
    try {
      tgtCount = (JSON.parse(tgtNpRaw).items as unknown[])?.length ?? 0;
    } catch {
      /* */
    }

    if (srcCount === 0 && tgtCount === 0) {
      update(3, { status: "pass", message: "No NetworkPolicies — all traffic allowed (default)" });
    } else {
      update(3, {
        status: "warn",
        message: `${srcCount + tgtCount} NetworkPolic${srcCount + tgtCount > 1 ? "ies" : "y"} found`,
        details: `Source namespace: ${srcCount}, Target namespace: ${tgtCount}. May restrict traffic.`,
      });
    }
  } catch {
    update(3, { status: "warn", message: "Could not check NetworkPolicies" });
  }

  // Check 5: DNS Resolution
  update(4, { status: "running" });
  try {
    const fqdn = `${targetService}.${targetNamespace}.svc.cluster.local`;
    const out = await runner.runSafe(
      ["exec", sourcePod, `-n`, sourceNamespace, `--context=${context}`, "--", "nslookup", fqdn],
      context,
    );
    if (out.includes("Address") && !out.includes("server can't find")) {
      update(4, {
        status: "pass",
        message: `DNS resolves: ${fqdn}`,
        details:
          out
            .split("\n")
            .filter((l) => l.includes("Address"))
            .pop() ?? "",
      });
    } else {
      update(4, {
        status: "fail",
        message: `DNS resolution failed for ${fqdn}`,
        details: "Check CoreDNS pods in kube-system, or nslookup not available in container",
      });
    }
  } catch {
    update(4, {
      status: "warn",
      message: "Could not test DNS (nslookup may not be available in container)",
    });
  }

  return buildResult(sourcePod, sourceNamespace, targetService, targetNamespace, checks);
}

function buildResult(
  sourcePod: string,
  sourceNamespace: string,
  targetService: string,
  targetNamespace: string,
  checks: ConnectivityCheck[],
): ConnectivityResult {
  const failures = checks.filter((c) => c.status === "fail").length;
  const warnings = checks.filter((c) => c.status === "warn").length;

  let summary: string;
  if (failures > 0) {
    summary = `${failures} check${failures > 1 ? "s" : ""} failed — connectivity is blocked`;
  } else if (warnings > 0) {
    summary = `All checks passed with ${warnings} warning${warnings > 1 ? "s" : ""}`;
  } else {
    summary = "All checks passed — connectivity looks healthy";
  }

  return { sourcePod, sourceNamespace, targetService, targetNamespace, checks, summary };
}
