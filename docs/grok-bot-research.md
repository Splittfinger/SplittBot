# Grok Bot research brief

- Research date: August 21, 2026
- Product launch: August 11, 2026
- Status: early beta / rapidly changing

## Executive summary

Grok Bot is a separate xAI/Cursor product, not simply the Grok chat model. Its product metaphor is a small roster of persistent AI teammates. A user creates named Bots, gives each one a job and boundaries, connects services, and messages them as if they were coworkers. The Bots can work in the background, use tools and websites, coordinate with one another, remember role-specific context, and stop for approval.

The most important product idea is not the model. It is the combination of:

- a durable named identity;
- an owned business outcome rather than a generic assistant role;
- an ongoing conversation and memory;
- connected tools plus browser/computer control;
- background execution;
- reusable skills and scheduled/event-triggered routines;
- visible multi-agent handoffs; and
- human approval before consequential actions.

The principal architectural weakness is that all Bots for one user share the same cloud computer, files, browser sessions, command-line credentials, and connector availability. xAI explicitly says separate Bots are not security boundaries. SplittBot should preserve controlled collaboration while isolating credentials and tools per agent.

## What Grok Bot is

xAI describes a Bot as one persistent, named AI teammate. It has a profile, a job, a conversation, memory, files, tools, and routines. Bots use a persistent managed Linux cloud computer with browser, filesystem, and terminal access. Work continues when the desktop or phone app is closed. See the [launch announcement](https://x.ai/news/introducing-grok-bot), [product page](https://x.ai/bot), and [overview](https://docs.x.ai/grok-bot/overview).

The launch is closely tied to Cursor:

- Authentication and account data settings use Cursor accounts.
- Eligible access is included with Cursor Ultra, Cursor Teams Premium, or SuperGrok Heavy.
- The cloud-computer implementation, plugin policy, billing, and enterprise controls use Cursor infrastructure.

## Confirmed feature inventory

### 1. Persistent named Bots

Each Bot has a name, title, description, avatar, conversation, job, working context, and learned preferences. xAI recommends one focused job per Bot and treats the description as the durable operating policy. Bots can be pinned, hidden, duplicated, edited, or deleted. A duplicate carries the profile, settings, enabled skills, routines, and avatar, but not history, learned memory, or attachments. Accounts can have up to 50 Bots and group chats combined. Source: [Create and manage Bots](https://docs.x.ai/grok-bot/bots).

### 2. Chat-first operation

Users give tasks in natural language and can attach text, links, images, and files; mention a Bot, group, routine, or connector; reference a skill; reply in threads; react; and redirect or stop ongoing work. Tool activity, computer use, files, questions, and approval requests appear in the same transcript. Source: [Message and collaborate](https://docs.x.ai/grok-bot/chat-and-collaboration).

### 3. Multi-Bot collaboration

Group chats contain two to six Bots. Users can address one Bot, multiple Bots, or the group, while Bots can asynchronously message each other, pass work, and reply later. xAI recommends one owner per stage and warns that too many parallel handoffs create duplicate work and noise. Source: [Message and collaborate](https://docs.x.ai/grok-bot/chat-and-collaboration).

### 4. Persistent cloud computer

All Bots for one user share one persistent managed Linux VM. Each Bot gets a separate screen so several can use browser/desktop tools in parallel, but the screens are not separate security boundaries. Browser cookies, signed-in sessions, files, and command-line credentials are shared. One Bot can run one computer-use task on its screen at a time. Source: [Use the computer and apps](https://docs.x.ai/grok-bot/computer-and-apps).

The user can watch the screen, take control for a password, passkey, two-factor code, CAPTCHA, payment, identity check, or human-only step, and return control. Cloud work continues when the local app closes.

### 5. Connectors and plugins

Connectors provide structured tools and are displayed as Plugins in the current app. Users browse the marketplace, install a plugin, and complete OAuth in a browser. xAI's general connector catalog lists built-in support for Gmail/Google Calendar, Google Drive, OneDrive, Outlook Mail/Calendar, Microsoft Teams, SharePoint, and Salesforce, plus catalog entries such as Box, Canva, Gamma, GitHub, Linear, Meltwater, Notion, S&P Global, and Vercel. Custom public MCP servers are also supported. Sources: [xAI connectors](https://docs.x.ai/grok/connectors) and [Cursor plugin flow](https://cursor.com/help/grok-bot/connect-plugins).

Plugin and connector availability is account-wide rather than isolated per Bot. Team admins can restrict marketplace plugins and MCP servers.

### 6. Files and reviewable artifacts

Supported inputs include images, audio, video, PDF, text, Word, Excel, PowerPoint, CSV, JSON, YAML, source code, HTML, email files, and Jupyter notebooks. The desktop composer accepts six attachments at once; documents, images, and audio can be up to 25 MB each, while video can be up to 200 MB. Results can appear as files, images, links, and tool cards. Source: [Files and results](https://docs.x.ai/grok-bot/files-and-results).

xAI's documentation consistently recommends results that separate facts, assumptions, completed actions, actions waiting for approval, and unresolved questions, with source links, screenshots, timestamps, filenames, and action logs.

### 7. Skills, teaching, and routines

A skill is a reusable method: inputs, steps, decision rules, validation, output, and approval boundary. A routine tells a particular Bot when to run a workflow. Source: [Skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations).

When available, “Teach a task” records up to ten minutes of visible browser interaction and converts the demonstration into a draft skill. The draft still needs decision rules, failure handling, and approval boundaries.

Routines can run on a schedule or, where supported, after an event such as a Slack message or GitHub notification. A Bot can own up to 50 routines, and the app retains the 20 most recent run records for each routine. Background routines work while the user's laptop is closed.

### 8. Approvals and auto-review

The product supports allow-once, deny, and saved allow rules. Model-based Auto Review can require approval or always allow narrowly matched actions; require-approval rules win conflicts. xAI recommends approval for messages, invitations, publishing, purchases, transfers, deletes, overwrites, permission changes, production changes, and acceptance of legal terms. Source: [Approvals, security, and privacy](https://docs.x.ai/grok-bot/approvals-security-and-privacy).

### 9. Notifications and attention states

The Bot list distinguishes working/typing, unread activity, and needs-attention states. Desktop/mobile notifications can report completion, questions, approvals, and handoffs. Notification and some rollout details vary by account. Source: [Settings and notifications](https://docs.x.ai/grok-bot/settings-and-notifications).

### 10. Mobile and platform support

The iPhone app uses the same Bots, conversations, routines, connectors, and shared computer. It supports messaging, dictation, attachments, Bot mentions, threads, reactions, approvals, and computer takeover. Advanced routine editing and teach-by-demonstration require desktop. Official launch documentation lists macOS, Windows, and iPhone on iOS 18 or later; Linux, Android, and iPad were not supported at launch. Sources: [Grok Bot for iOS](https://docs.x.ai/grok-bot/mobile) and [FAQ](https://docs.x.ai/grok-bot/faq).

### 11. Team and enterprise controls

Each team member gets one dedicated cloud VM shared by that member's Bots. Existing Cursor SSO, privacy, MCP, team rules, and team membership apply. Admins can allow or deny MCP servers, manage team plugins, provide setup scripts, view usage, and remove member computers. An action-level audit view and a Grok-specific spend cap were still listed as future work at launch. Source: [Teams and enterprises](https://docs.x.ai/grok-bot/teams-and-enterprises).

### 12. Pricing and usage

The launch product page listed Cursor Ultra at $200/month, SuperGrok Heavy at $300/month, and Cursor Premium Teams at $120/seat/month. Paid access includes a weekly usage allocation; on-demand usage can continue when enabled. A trial is consumption-based and also has a seven-day window. Long tasks consume usage based on agent steps and tokens rather than message count. Pricing is volatile and should be rechecked before any purchasing decision. Sources: [Grok Bot product page](https://x.ai/bot) and [Cursor plans and billing](https://cursor.com/help/grok-bot/plans).

## Product organization and interaction model

Grok Bot is organized around a roster rather than a workflow canvas:

1. Create a teammate from a suggestion or a blank profile.
2. Give it a short name, one primary job, and a durable operating description.
3. Message it with an outcome, sources, constraints, deliverable, and review point.
4. Connect tools only when the Bot reaches a need.
5. Watch work in the transcript or cloud-computer view.
6. Correct the result and explicitly save durable preferences.
7. Save a successful method as a skill.
8. Test it again before scheduling a routine.
9. Add another specialist only when work has a stable separate owner.
10. Use a group chat when the handoff itself must be visible.

This progression is one of the strongest parts of the design. It lets a user start with normal conversation, then gradually formalize reliable work.

## Documented use cases

xAI's first-party examples cluster around repeatable, multi-system work:

- Sales outbound: research, contact prioritization, and review-ready outreach.
- Talent scout: candidate sourcing, evidence, drafts, and scheduling preparation.
- Paid media: monitoring, budget analysis, recommendations, and draft updates.
- Expense manager: reconciliation, missing information, policy exceptions, and follow-up drafts.
- Product performance: evidence-linked observability investigations.
- Bug reproduction: staging reproduction packs, screenshots, logs, and test cases.
- Account health: ranked risk/expansion watch lists.
- Chief of staff: source-linked changes, next steps, and decisions needed.

The recurring pattern is “read and prepare first; act only after approval.” Source: [Use cases](https://docs.x.ai/grok-bot/use-cases).

## Security and privacy findings

### Shared-computer boundary

Every Bot can potentially use the same files, browser sessions, command-line credentials, and installed connectors. Separate Bots must not be treated as isolated identities or least-privilege roles. Deleting a Bot does not delete shared files or sign-ins.

### Credential handling

Users perform passwords, passkeys, two-factor codes, CAPTCHAs, and payment confirmations through takeover or a masked secret request. Ordinary chat should never contain secrets. Hosted MCP tokens reportedly remain on Cursor's backend rather than inside the VM.

### Approval limitations

An approval governs a proposed action; it does not undo earlier actions. Auto Review is model-based and should not replace least privilege. At launch, personal auto-review rules were stored per desktop setup rather than as a universally synchronized account policy.

### Enterprise gaps at launch

The team documentation said an action audit view was coming, there was no Grok-specific spend cap, and a team-level ceiling for local-computer execution was also coming. These are material gaps for high-risk organizational use.

## Early user reports: useful but unverified

Launch-week reports are anecdotal and may reflect beta defects, account-specific behavior, or user setup.

One business user reported running six agents and praised the quality of customized communications and the ability to operate arbitrary websites. The same user reported daily Chrome-profile resets, frequent browser crashes, fast consumption of weekly usage, and apparent concurrency of only one or two active agents. Source: [Reddit early-use report](https://www.reddit.com/r/grok/comments/1vob5q2/grok_bot/).

Cursor's help center also documents known operational friction, including reauthorization, routine failures, cloud-computer recovery, app hangs, and a known Zoom OAuth redirect failure. Sources: [Getting started and troubleshooting](https://cursor.com/help/grok-bot/getting-started) and [Connect plugins](https://cursor.com/help/grok-bot/connect-plugins).

Treat the following as hypotheses to test, not settled facts:

- browser state and profile persistence may be the weakest reliability layer;
- practical concurrency may be lower than the conceptual multi-Bot design;
- usage can be difficult to predict for long browser-driven tasks;
- group collaboration is compelling but can create duplicated work without explicit ownership; and
- approval policy and audit controls need to mature before high-risk automation.

## What is distinctive versus ordinary chat

| Capability | Ordinary assistant chat | Grok Bot |
|---|---|---|
| Identity | One general assistant | Named, role-specific teammates |
| State | Conversation-level | Durable profile, memory, files, sign-ins, routines |
| Execution | Usually synchronous | Background and scheduled work |
| Tools | Per-chat or built-in | Connectors, MCP, browser, terminal, files |
| Collaboration | User coordinates | Bots message and hand off to Bots |
| Interface | Answer-centric | Transcript plus activity, artifacts, approvals, computer view |
| Automation | Separate builder common | Conversation first, then skill/routine |
| Risk control | Prompt instructions | Approval cards plus auto-review rules |

## Research coverage and limitations

This is a comprehensive scan of the publicly indexed first-party launch corpus available on August 21, 2026, supplemented by a small number of early user reports. It is not literally every post, video, private beta discussion, or unindexed page on the internet. The product is ten days old, documentation is changing, and some controls are gradually rolling out.

Primary pages reviewed:

- [Introducing Grok Bot](https://x.ai/news/introducing-grok-bot)
- [Grok Bot product page](https://x.ai/bot)
- [Overview](https://docs.x.ai/grok-bot/overview)
- [Get started](https://docs.x.ai/grok-bot/get-started)
- [Use cases](https://docs.x.ai/grok-bot/use-cases)
- [Grok Bot for iOS](https://docs.x.ai/grok-bot/mobile)
- [Create and manage Bots](https://docs.x.ai/grok-bot/bots)
- [Message and collaborate](https://docs.x.ai/grok-bot/chat-and-collaboration)
- [Files and results](https://docs.x.ai/grok-bot/files-and-results)
- [Use the computer and apps](https://docs.x.ai/grok-bot/computer-and-apps)
- [Skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations)
- [Settings and notifications](https://docs.x.ai/grok-bot/settings-and-notifications)
- [Approvals, security, and privacy](https://docs.x.ai/grok-bot/approvals-security-and-privacy)
- [Teams and enterprises](https://docs.x.ai/grok-bot/teams-and-enterprises)
- [FAQ](https://docs.x.ai/grok-bot/faq)
- [xAI connectors](https://docs.x.ai/grok/connectors)
- [Cursor getting started](https://cursor.com/help/grok-bot/getting-started)
- [Cursor plans and billing](https://cursor.com/help/grok-bot/plans)
- [Cursor plugin connections](https://cursor.com/help/grok-bot/connect-plugins)

## Design lessons for SplittBot

Keep:

- the teammate roster;
- role ownership and durable descriptions;
- chat-first onboarding;
- visible work, artifacts, and handoffs;
- progressive formalization from task to skill to routine;
- background execution and mobile approvals;
- explicit “needs attention” states; and
- connector-first integrations with browser fallback.

Improve:

- isolate credentials and connector scopes per agent;
- make every consequential action a two-phase propose/commit transaction;
- provide the audit trail at launch;
- show estimated and actual cost per run;
- make retries idempotent;
- distinguish memory from current authoritative data;
- separate a shared artifact workspace from shared secrets;
- make dry-run/testing a first-class mode; and
- use browser automation only when a structured tool is unavailable.
