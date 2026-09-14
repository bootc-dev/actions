import { spawnSync } from 'node:child_process';

const image = 'quay.io/centos-bootc/centos-bootc:stream10';
const localImage = 'localhost/bcvk-libvirt-smoke:latest';
const vmName = process.env.VM_NAME;

function run(command, args, timeout = '2m') {
  const result = spawnSync('timeout', [
    '--foreground', '--signal=TERM', '--kill-after=30s', timeout, command, ...args,
  ], { stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    const status = result.status ?? 1;
    throw Object.assign(
      new Error(`${command} failed (${result.signal ?? `status ${status}`})`),
      { status },
    );
  }
}

if (!vmName) throw new Error('VM_NAME must be set');

let failure;
try {
  run('podman', ['pull', image], '12m');
  run('podman', ['tag', image, localImage]);
  run('bcvk', [
    'libvirt', 'run', '--connect', 'qemu:///session', '--name', vmName,
    '--firmware=uefi-insecure', '--disable-tpm', '--ssh-wait',
    '--memory=2048', '--cpus=2', '--disk-size=12G', localImage,
  ], '12m');
  run('bcvk', ['libvirt', 'ssh', '--connect', 'qemu:///session', vmName, '--', 'hostname']);
  console.log('CentOS Stream 10 bootc guest reached SSH through libvirt');
} catch (error) {
  failure = error;
} finally {
  try {
    run('bcvk', ['libvirt', 'rm', '--connect', 'qemu:///session', '--force', vmName]);
  } catch (error) {
    console.warn(`Warning: VM cleanup failed: ${error.message}`);
  }
}

if (failure) {
  console.error(`Probe failed: ${failure.message}`);
  process.exitCode = failure.status;
}
