# GIROC Incident Reporting Chatbot

An LAG-powered chatbot that helps users report incidents in free text, extracts structured fields, and progressively fills a dynamic incident reporting form.

## Overview

This project is designed to make incident reporting easier. Instead of manually filling a long form, users can describe an incident in natural language, and the chatbot will:

- extract relevant form fields
- populate the incident report structure
- ask follow-up questions for missing required information
- support branching form logic
- optionally score or review extraction quality with a critic step

This project currently uses a Node.js backend and can be connected to a React frontend. It can work with OpenAI, Hugging Face, or local Ollama models depending on your setup.

---

## Features

- Free-text incident reporting
- Structured field extraction into JSON
- Conditional and branching form logic
- Follow-up question generation
- Backend API for extraction and chat
- Optional React frontend
- Support for multiple model providers
- Optional critic/review step for checking output quality

---

## Project Structure

