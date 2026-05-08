---
name: agent-system-prompt
description: |
  Use this skill when the user needs to write the actual instructional text that defines
  how an AI agent behaves. This is the skill for crafting the core "brain instructions" —
  the system prompt, persona, or behavioral rules that go into making an AI assistant,
  chatbot, or agent act in a specific way.

  Trigger for requests to:
  - Create or design a system prompt, instruction set, or persona for any AI agent
  - Write the "instructions" field for a custom GPT, Claude project, or similar platform
  - Define what an AI should or shouldn't do, how it should talk, or what tasks it handles
  - Help someone make their AI follow specific rules or adopt a particular personality
  - Improve, refactor, or debug an existing system prompt

  Also trigger for Chinese queries mentioning: 系统提示词, system prompt, AI 助手, 智能体,
  机器人, 人设, or similar terms about defining agent behavior.

  If the user's goal is to produce written text that controls AI behavior, use this skill.
  If they need to write code, set up APIs, build infrastructure, or handle technical
  implementation, they need a different skill.

  This skill guides you through a structured interview-and-draft process to produce
  clear, effective system prompts grounded in prompt engineering best practices.
---

# Agent System Prompt Generator

A structured workflow for crafting effective LLM agent system prompts, from scratch or from an existing draft.

## When to Use This Skill

- Creating a new agent from scratch — user describes what they want, you interview and draft
- Improving an existing prompt — user provides the current version, you diagnose and rewrite
- Refactoring a prompt for a different platform (e.g., moving from OpenAI to Claude)

## Core Philosophy

A system prompt is a contract between the developer and the model. It should be:
- **Clear** — the model never has to guess what's expected
- **Complete** — covers the agent's role, boundaries, behavior, and output format
- **Concise** — every sentence earns its place; fluff dilutes signal

The goal is not to write a long prompt, but to write a *precise* one.

---

## Step 1: Gather Requirements

Interview the user to understand the agent's purpose. Ask these questions (adapt to context — if the user already provided some of this, don't re-ask):

### 1.1 Identity & Role
- What is this agent's name/identity?
- What role does it play? (e.g., "senior code reviewer", "customer support agent", "data analyst")
- What persona or tone should it adopt? (formal, casual, expert, friendly)

### 1.2 Scope & Capabilities
- What tasks should this agent handle?
- What tools or APIs does it have access to?
- What domains of knowledge does it need?

### 1.3 Boundaries & Safety
- What should the agent refuse to do?
- Are there compliance, legal, or safety constraints?
- How should it handle ambiguous or out-of-scope requests?

### 1.4 Behavior & Style
- How verbose should responses be?
- Should it ask clarifying questions or make assumptions?
- How should it handle uncertainty — state it, hedge, or refuse?

### 1.5 Output Format
- Does the agent need a specific response structure (JSON, markdown, bullet points)?
- Should it include citations, sources, or confidence levels?
- Are there templates it should follow?

### 1.6 Context & Examples
- What input format does the agent receive?
- Can the user provide 1-2 examples of ideal input→output pairs?

---

## Step 2: Draft the System Prompt

Use this structure as a starting point. Not every section is required — include only what's relevant.

### System Prompt Template

```markdown
# Role

You are [role name/identity]. [1-2 sentences on what this agent does and who it serves.]

# Core Responsibilities

- [Responsibility 1]
- [Responsibility 2]
- [Responsibility 3]

# Behavioral Guidelines

[How the agent should approach tasks, ask questions, handle edge cases]

## Tone & Style
[Communication style — formal/casual, verbose/concise, etc.]

## Handling Uncertainty
[What to do when the agent doesn't know or the request is ambiguous]

# Constraints

- [Hard constraint 1 — things the agent must never do]
- [Hard constraint 2]
- [Soft constraint — things to prefer but can flex on]

# Output Format

[Describe the expected structure of responses. Use a template if applicable.]

# Context

[Any domain knowledge, background info, or reference material the agent needs]
```

### Writing Principles

**1. Define by behavior, not by trait.**
- Bad: "You are helpful and knowledgeable."
- Good: "When a user asks a question, research the topic thoroughly before responding. Cite sources when making factual claims."

**2. Use positive instructions over negative ones.**
- Bad: "Don't give medical advice."
- Good: "If a question touches on health or medical topics, recommend consulting a qualified healthcare professional and do not provide specific diagnoses or treatments."

**3. Show, don't just tell.**
Include 1-2 concrete examples of ideal behavior when the agent's output format or reasoning process is non-obvious.

**4. Handle edge cases explicitly.**
Don't assume the model will "figure it out." If there's a tricky scenario, write instructions for it:
- "If the user's request is vague, ask one clarifying question before proceeding."
- "If the requested information is not in the provided context, say so rather than guessing."

**5. Use structured formatting for scannability.**
Models process structured prompts more reliably. Use headers, bullet points, and numbered lists. Avoid walls of paragraph text.

**6. Balance specificity with flexibility.**
Over-constrained prompts break on edge cases. Under-constrained prompts drift. Aim for clear guardrails with room for judgment.

**7. Keep it concise.**
Every sentence in a system prompt competes for attention. If removing a sentence doesn't change behavior, remove it.

---

## Step 3: Review & Refine

After drafting, review the prompt against this checklist:

### Quality Checklist

- [ ] **Role clarity**: Could someone unfamiliar with the project read this and understand what the agent does?
- [ ] **Boundary clarity**: Are the "do" and "don't" boundaries unambiguous?
- [ ] **Edge cases**: Are failure modes and ambiguity handled?
- [ ] **Output format**: Is the expected response structure clear?
- [ ] **No contradictions**: Do any instructions conflict with each other?
- [ ] **Conciseness**: Can any sentence be removed without changing behavior?
- [ ] **Examples**: If the output format is non-obvious, is there an example?

### Common Pitfalls to Flag

| Pitfall | Problem | Fix |
|---------|---------|-----|
| "You are an AI assistant" | Wastes tokens stating the obvious | Remove or replace with specific role |
| "Be helpful, harmless, honest" | Too vague to guide behavior | Replace with specific behavioral rules |
| Long personality backstory | Distracts from functional instructions | Keep persona to 1-2 sentences |
| Contradicting instructions | Model will follow one and ignore the other | Resolve the conflict explicitly |
| No output format specified | Responses will vary wildly in structure | Add a template or format guide |
| Ignoring edge cases | Model will hallucinate or break character | Add explicit handling instructions |

---

## Platform Notes

While this skill generates platform-agnostic prompts, here are adjustments for common platforms:

**Claude (Anthropic)**
- Claude responds well to XML tags for structuring prompt sections (e.g., `<role>`, `<instructions>`, `<examples>`)
- Prefers direct, conversational instructions
- Handles long context windows well

**OpenAI GPTs / ChatGPT**
- Works well with markdown headers and bullet points
- "Instructions" field in GPT builder has a character limit — be concise
- Supports `system` + `developer` message layers

**General LLM APIs**
- Keep prompts under the model's effective context window
- Place the most important instructions at the beginning and end (primacy/recency bias)
- Test with the actual model — prompt effectiveness varies across models

---

## Example: Generated Prompt

**User request**: "I need an agent that reviews Python code for security vulnerabilities."

**Generated system prompt**:

```
# Role

You are a security-focused Python code reviewer. You analyze Python code for
security vulnerabilities, OWASP Top 10 risks, and common anti-patterns.

# Core Responsibilities

- Identify security vulnerabilities in Python code (injection, auth issues,
  data exposure, etc.)
- Explain why each finding is a risk, with severity rating (Critical/High/Medium/Low)
- Provide concrete remediation code for each finding
- Flag dependencies with known CVEs when visible in requirements files

# Behavioral Guidelines

Review code thoroughly before responding. Do not just scan for obvious patterns —
consider the full attack surface including input validation, authentication flows,
data serialization, and dependency usage.

When you find a vulnerability:
1. Name it clearly (e.g., "SQL Injection via string formatting")
2. Rate its severity
3. Show the vulnerable code snippet
4. Provide the fixed version with explanation

## Handling Uncertainty

If the code is incomplete or context is missing, note what additional information
would be needed for a complete review, but still review what's available.

If you're unsure whether something is a true vulnerability or acceptable risk,
flag it as "Potential Issue" and explain the tradeoff.

# Constraints

- Do not suggest rewriting the entire codebase — focus on actionable, targeted fixes
- Do not flag style issues (formatting, naming) unless they directly cause security risks
- Do not provide exploits or proof-of-concept attack code

# Output Format

Structure your review as:

## Summary
[1-2 sentence overall assessment]

## Findings

### [Finding 1 Title]
- **Severity**: Critical | High | Medium | Low
- **Location**: `file.py:line`
- **Issue**: [What's wrong]
- **Risk**: [Why it matters]
- **Fix**: [Remediation code]

[Repeat for each finding]

## Recommendations
[Top 3 prioritized actions to improve security posture]
```
