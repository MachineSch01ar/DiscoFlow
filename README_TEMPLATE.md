# n8n-nodes-_node-name_

This is an n8n community node. It lets you use _app/service name_ in your n8n workflows.

_App/service name_ is _one or two sentences describing the service this node integrates with_.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  <!-- delete if no auth needed -->  
[Compatibility](#compatibility)  
[Usage](#usage)  <!-- delete if not using this section -->  
[Troubleshooting](#troubleshooting)  
[Resources](#resources)  
[Release notes](#release-notes)  <!-- delete if not using this section -->  

## Installation

Document all supported install paths that apply:

- GUI install from npm in n8n (`Settings > Community Nodes`)
- Manual npm install for self-hosted/Docker/queue mode
- Local `npm link` flow for development/private usage

Reference:

- https://docs.n8n.io/integrations/community-nodes/installation/
- https://docs.n8n.io/integrations/community-nodes/installation/manual-install/
- https://docs.n8n.io/hosting/configuration/environment-variables/nodes/

## Operations

List resources and operations exactly as they appear in node UI. Include key parameters or mode differences where needed.

If applicable, include the upstream API endpoints each operation maps to.

## Credentials

_If users need to authenticate with the app/service, provide details here. You should include prerequisites (such as signing up with the service), available authentication methods, and how to set them up._

## Compatibility

State compatibility constraints:

- self-hosted vs cloud limitations
- required n8n node API version or minimum tested n8n version
- environment variables that can block loading (`N8N_COMMUNITY_PACKAGES_ENABLED`, `N8N_CUSTOM_EXTENSIONS`, etc.)

## Usage

_This is an optional section. Use it to help users with any difficult or confusing aspects of the node._

_By the time users are looking for community nodes, they probably already know n8n basics. But if you expect new users, you can link to the [Try it out](https://docs.n8n.io/try-it-out/) documentation to help them get started._

## Troubleshooting

Add common failure modes and fixes, for example:

- credentials/authentication errors
- invalid/missing input fields
- endpoint-specific requirements
- install/load issues after package install

Keep this short and task-oriented.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* _Link to app/service documentation._
* _Link to authoritative API schema/reference if available._

## Release notes

If your node is pre-release, document current implementation scope under an `Unreleased` section and note your first intended public version.

If your node has public releases, include a concise summary of versioned changes and link to `CHANGELOG.md` when present.

Docs hygiene checklist:

- Ensure README operations match actual node operations.
- Ensure release/changelog policy text matches your project phase (pre-release vs released).
- Ensure external doc links are still valid.
