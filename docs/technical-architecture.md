# Technical Requirements

Bee TV is designed and engineered to be a robust platform based on pragmatic choices.

Currently, it is a MVP (Minimum Viable Product). The principles, technical drivers, and decisions take into account its lifecycle, and where it is.

## Architecture

Bee TV is two-tier solution: a RESTful backend and a modern Single-Page Application frontend. It has no data (analytics) tier, and its infrastructure and deployables are containers (OCI; _Open Container Initiative_).

A simple relational database is required and enough for the application's backend.

### Backend tier

The following requirements (principles and drivers) are mandatory for the backend application.

* Python and FastAPI. Endpoints are lightweight functions
* REST is the protocol over HTTP to expose capabilities. All common and ordinary REST conventions must be observed
* Application's design: Vertical Slice Architecture (aka: Package-by-Feature, or Feature-Driven Architecture)
    * A feature is always self-contained. No cross dependencies
    * Use-cases are implemented within the endpoint handler (function) to ease and simplify the design
* SOLID must be observed for implementation
* Idiomatic Python code, _Object-Oriented Paradigm_ (OOP)
* Lint and code analysis tool is required
* Types are _testable_ and _mockable_
* Unit tests for all types, functions and testable constructs
* Asynchronous I/O is mandatory for all IO-bound operations
* Logging into endpoints' implementations and critical services are required
* Error-handling is part of the architecture: rely on Global Exception Handlers
    * Retry patterns like circuit-breaker should be considered per case, per integration. That is, it has context

Important note: authentication and authorization are not required for the MVP scope. A user ("guest") should be mocked for now.

#### Application Database

The selected database is MySQL. MySQL is a highly-portable, SQL-compliant, and battle-tested relational database. Its capacities are enough for the MVP phase.

### Frontend tier

The following requirements (principles and drivers) are mandatory for the frontend application.

* Typescript and React
* Deployment architecture: Single-Page Application
* Stack: Bun (runtime) and Vite (build)
* Application's design: Feature-Folder Development. Self-contined features
* SOLID must be observed for implementation
* Lint and code analysis tool is required
* Types are _testable_ and _mockable_
* Unit tests for all types, functions and testable constructs
* A design-system is required to build and keep consistently the user interface
    * Material UI (MUI) should be used while the Design & Experience team is working in the complete experience
* Basic responsiveness design is expected. Not optimized for mobile, but it is welcome
* Basic accessibility and navigation friendness are expected and gated as quality
* Friendly error-handling experience through _creative user experience to inform service unavailability_ is highly expected for all features and touch points

### DevOps practices

The following DevOps practices should be observed and respected to hand-off the solution to the Operations team.

* Docker Compose v3.3+ for running the solution containers
* One container per deployable. For database, persistent storage is allowed
* Application (frontend) runs on port 7777
* Automation: Everything must run with a single command