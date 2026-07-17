---
name: cloud-logging-sink-setup
description: Configure cloud logging sink setup operations. Auto-activating skill
  for GCP Skills.
allowed-tools: Read, Write, Edit, Bash(gcloud:*)
model: sonnet
version: 1.0.0
category: 03-devops-infrastructure
tags: []
harness:
- claude-code
- opencode
---

# Cloud Logging Sink Setup

## Overview

This skill provides automated assistance for cloud logging sink setup tasks within the GCP Skills domain.

## When to Use

This skill activates automatically when you:
- Mention "cloud logging sink setup" in your request
- Ask about cloud logging sink setup patterns or best practices
- Need help with google cloud platform skills covering compute, storage, bigquery, vertex ai, and gcp-specific services.

## Instructions

1. Provides step-by-step guidance for cloud logging sink setup
2. Follows industry best practices and patterns
3. Generates production-ready code and configurations
4. Validates outputs against common standards

## Examples

**Example: Basic Usage**
Request: "Help me with cloud logging sink setup"
Result: Provides step-by-step guidance and generates appropriate configurations


## Prerequisites

- Relevant development environment configured
- Access to necessary tools and services
- Basic understanding of gcp skills concepts


## Output

- Generated configurations and code
- Best practice recommendations
- Validation results


## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| Configuration invalid | Missing required fields | Check documentation for required parameters |
| Tool not found | Dependency not installed | Install required tools per prerequisites |
| Permission denied | Insufficient access | Verify credentials and permissions |


## Resources

- Official documentation for related tools
- Best practices guides
- Community examples and tutorials

## Related Skills

Part of the **GCP Skills** skill category.
Tags: gcp, bigquery, vertex-ai, cloud-run, firebase
