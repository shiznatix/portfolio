# Manage Machines

A TypeScript CLI tool (`mm`) for managing services across my home automation/server machines. It handles installing, configuring, starting, stopping, and syncing 50+ services with a single consistent interface. Provides a framework for quickly adding and assigning hosts new services with a focus on total TypeScript typing support and shell tab-completion.

Special care is placed on the TypeScript types, to prevent self and circular references from deviating from reality. References and links to other hosts have complete type controls, making it simple to ensure the configurations deployed to different machines are correct. The types also ensure that service configurations are complete and correct.

## How It Works

The tool is built around a **mixin-based service factory** pattern. Each service is defined as a class assembled from a collection of mixins that provide common capabilities - package managers (apt, snap, npm, pip), systemd unit file/service management, Docker container control, config file sync, rsync, and more. Services declare their actions and lifecycle hooks via decorators (`@action`, `@hook`, `@actionFlag`), which also drive shell completion and CLI help text.

An **inventory** layer maps hosts to their services and configuration props, keeping infrastructure definitions separate from the generic framework. Hosts can be targeted individually or via groups (`all-devices`, `raspberry-pi`, etc.).

For argv parsing `yargs` is used, and a custom auto-completion function is implemented that uses the current args to generate the options for the current completion request. Being context aware removes any confusion about what commands and flags are available at any time.

## Challenges

- **Flexible framework** — the framework had to be able to handle any requirement that a service could have
- **Complete type checks** — if a value should be bound to any specific union or type, it is
- **Circular references** — hosts can reference themselves or each other circularly, while maintaining types for individual service config values
- **Simple inventory** — hosts and services can be added with minimum effort while being easy to edit and logical to read
- **Stack services** — making service configuration simple when it is a stack of multiple services (ie frontend and backend)

## Folder Structure

- **core** — a slightly opinionated service and host framework
- **inventory/hosts** — all managed hosts with their base configuration (ip, name, etc) and their service specific configurations
- **inventory/services** — all services that can be managed from this tool

## Example Commands

```bash
# install and configure `docker` on the host `redhouse`. all dependencies, user groups, etc are done
mm redhouse docker install
# all host machines with the group `all-devices` will be rebooted
mm all-devices system restart
# sync all files from the local dev machine to the `redhouse` host. will restart the service and then will follow log messages from `journalctl`
mm redhouse crayclk sync --follow
```

## Tech Stack

- **TypeScript** — core language with heavy use of generics for type-safe everything
- **bun** — build the project into a single binary to increase tab-completion speed
- **yargs** — argv parser and framework
- **chalk** — for easy to read logs
