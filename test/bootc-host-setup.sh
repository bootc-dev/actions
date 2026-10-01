#!/usr/bin/env bash
set -euo pipefail

action_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../bootc-host-setup" && pwd)
# shellcheck source=../bootc-host-setup/ci/install-deps.sh
# shellcheck disable=SC1091
. "${action_dir}/ci/install-deps.sh"

packages=()
read_packages "${action_dir}/packages/rhel-base"
test "${packages[*]}" = 'git-core podman curl tar gzip gcc rust cargo'

packages=()
read_packages "${action_dir}/packages/ubuntu-libvirt"
test "${packages[0]}" = libkrb5-dev
test "${packages[-1]}" = python3-virt-firmware

packages=()
read_packages "${action_dir}/packages/rhel-libvirt"
test "${packages[2]}" = libvirt-devel
test "${packages[4]}" = libvirt-daemon-driver-storage-core
test "${packages[-1]}" = python3-virt-firmware

# These literals are deliberately static assertions against the narrowly
# confined partner-image workaround.
# shellcheck disable=SC2016
grep -Fqx '  local expected_target=/usr/share/crypto-policies/DEFAULT/openssh.txt target diagnostic expected_diagnostic' "${action_dir}/ci/workarounds.sh"
# shellcheck disable=SC2016
grep -Fqx '  test "$(sudo rpm -qf --qf '\''%{NAME}'\'' "$target")" = crypto-policies' "${action_dir}/ci/workarounds.sh"
# shellcheck disable=SC2016
grep -Fqx '  test "$(sudo stat -c '\''%u:%g:%a'\'' -- "$target")" = 0:0:644' "${action_dir}/ci/workarounds.sh"
# shellcheck disable=SC2016
grep -Fqx '    test "$(getenforce)" = Enforcing' "${action_dir}/ci/test-environment.sh"
# shellcheck disable=SC2016
grep -Fqx '    test -x /usr/sbin/virtstoraged' "${action_dir}/ci/test-environment.sh"
# shellcheck disable=SC2016
grep -Fqx '    dbus-run-session -- virsh -c qemu:///session pool-list --all' "${action_dir}/ci/test-environment.sh"

# The per-user libvirt configuration must be installed before the session
# daemon starts, without changing the host SELinux enforcement mode.
# shellcheck disable=SC2016
grep -Fqx '  local config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/libvirt"' "${action_dir}/ci/workarounds.sh"
# shellcheck disable=SC2016
grep -Fqx '  cat > "$config_dir/qemu.conf" <<'"'"'EOF'"'"'' "${action_dir}/ci/workarounds.sh"
# shellcheck disable=SC2016
grep -Fqx 'security_driver = "none"' "${action_dir}/ci/workarounds.sh"
# shellcheck disable=SC2016
grep -Fqx '    qemu_config="${XDG_CONFIG_HOME:-$HOME/.config}/libvirt/qemu.conf"' "${action_dir}/ci/test-environment.sh"
# shellcheck disable=SC2016
grep -Fqx '    printf '\''%s\n'\'' '\''security_driver = "none"'\'' | cmp --silent - "$qemu_config"' "${action_dir}/ci/test-environment.sh"
