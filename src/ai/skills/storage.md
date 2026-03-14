# Storage & Volume Troubleshooting

## PVC Pending

- PVC stays in Pending state — cannot bind to a PersistentVolume
- Check: `kubectl describe pvc <name>` → Events
- StorageClass not found: verify storageClassName exists (`kubectl get storageclass`)
- No matching PV: for static provisioning, PV capacity/accessMode must match
- Dynamic provisioning: check CSI driver pods are running in kube-system

## Volume Mount Failures

- MountVolume.SetUp failed: volume can't be mounted on the node
- Multi-attach error: EBS/Azure Disk (ReadWriteOnce) already attached to another node
  - Fix: delete the pod on the old node, or use ReadWriteMany volumes (EFS/NFS)
- Permission denied: check fsGroup in securityContext
- Subpath issues: verify the subPath exists in the volume

## EBS/EFS (AWS)

- EBS: ReadWriteOnce only, single AZ. Pod and volume must be in same AZ
- EFS: ReadWriteMany, cross-AZ. Use for shared storage between pods
- CSI driver required: `aws-ebs-csi-driver` or `aws-efs-csi-driver`
- IAM permissions: EBS CSI needs `ec2:CreateVolume`, `ec2:AttachVolume`, etc.

## ConfigMap/Secret as Volumes

- Mounted as files in the pod's filesystem
- Updates propagate automatically (with delay) for mounted volumes
- Updates do NOT propagate for env vars — pod restart required
- Optional: true in volumeMount prevents pod from failing if ConfigMap doesn't exist

## EmptyDir

- Ephemeral volume — data lost on pod restart
- Shared between containers in the same pod (sidecar pattern)
- Medium: Memory — creates tmpfs, counts against container memory limit
