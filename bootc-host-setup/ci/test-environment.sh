#!/usr/bin/env bash
set -euo pipefail

libvirt=${BOOTC_HOST_LIBVIRT:-false}
# shellcheck disable=SC1091
. /etc/os-release
case "$ID" in ubuntu|rhel) ;; *) exit 1 ;; esac
podman --version
just --version
test -n "${GITHUB_ENV:-}"

if [ "$libvirt" = true ]; then
  test -x "$(command -v virsh)"
  test -x "$(command -v virt-fw-vars)"
  virtiofsd=$(command -v virtiofsd || true)
  test -x "${virtiofsd:-/usr/lib/qemu/virtiofsd}"
  if [ "$ID" = rhel ]; then
    test "$(getenforce)" = Enforcing
    test -r /dev/kvm && test -w /dev/kvm
    test -x /usr/sbin/virtstoraged
    qemu_config="${XDG_CONFIG_HOME:-$HOME/.config}/libvirt/qemu.conf"
    printf '%s\n' 'security_driver = "none"' | cmp --silent - "$qemu_config"
    dbus-run-session -- virsh -c qemu:///session list --all
    dbus-run-session -- virsh -c qemu:///session pool-list --all
  fi
fi
