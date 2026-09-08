# Graph Report - myst-gradum-api  (2026-09-08)

## Corpus Check
- Corpus is ~4,799 words - fits in a single context window. You may not need a graph.

## Summary
- 284 nodes · 428 edges · 16 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Toolchain e Metadados do Pacote
- Bootstrap do App e Constantes
- Configuracao e Infra do Postgres
- Decorators, Pipes e Health
- Query, Filtro e Ordenacao
- Paginacao
- Excecoes e Filtro HTTP
- Opcoes do Compilador TypeScript
- Dependencias de Producao
- Dependencias de Desenvolvimento
- Envelope de Response
- Roles e Tipos do Express
- Scripts npm
- Configuracao do Nest CLI
- TSConfig de Build

## God Nodes (most connected - your core abstractions)
1. `@nestjs/common` - 22 edges
2. `compilerOptions` - 19 edges
3. `PaginationDto` - 13 edges
4. `scripts` - 9 edges
5. `AllExceptionsFilter` - 8 edges
6. `ResponseInterceptor` - 8 edges
7. `QueryDto` - 7 edges
8. `applyQueryParams()` - 7 edges
9. `HealthController` - 7 edges
10. `@nestjs/config` - 6 edges

## Surprising Connections (you probably didn't know these)
- `PaginatedResult` --references--> `PaginationMeta`  [EXTRACTED]
  src/common/helpers/paginate.helper.ts → src/common/interfaces/api-response.interface.ts
- `QueryDto` --inherits--> `PaginationDto`  [EXTRACTED]
  src/common/dto/query.dto.ts → src/common/dto/pagination.dto.ts
- `createPagination()` --calls--> `PaginationDto`  [EXTRACTED]
  src/common/helpers/paginate.helper.spec.ts → src/common/dto/pagination.dto.ts
- `Request` --references--> `Role`  [EXTRACTED]
  src/common/types/express.d.ts → src/common/enums/role.enum.ts
- `run()` --calls--> `AllExceptionsFilter`  [EXTRACTED]
  src/common/filters/http-exception.filter.spec.ts → src/common/filters/http-exception.filter.ts

## Import Cycles
- None detected.

## Communities (16 total, 0 thin omitted)

### Community 0 - "Toolchain e Metadados do Pacote"
Cohesion: 0.06
Nodes (30): config, description, engines, node, license, name, private, version (+22 more)

### Community 1 - "Bootstrap do App e Constantes"
Cohesion: 0.10
Nodes (22): class-transformer, class-validator, helmet, @nestjs/testing, rxjs, supertest, AppModule, Module (+14 more)

### Community 2 - "Configuracao e Infra do Postgres"
Cohesion: 0.12
Nodes (18): gradum-network Bridge Network, pg_data Local Volume, Postgres 16 Alpine Service (gradum-postgres), @nestjs/config, @nestjs/core, zod, Env, envSchema (+10 more)

### Community 3 - "Decorators, Pipes e Health"
Cohesion: 0.11
Nodes (14): ApiOkResponse, ApiTags, Controller, Get, @nestjs/common, SkipThrottle, CurrentUser, IS_PUBLIC_KEY (+6 more)

### Community 4 - "Query, Filtro e Ordenacao"
Cohesion: 0.13
Nodes (21): IsIn, @nestjs/swagger, FILTER_PREFIX, filterKey(), QueryDto, SORT_ORDERS, SortOrder, ApiPropertyOptional (+13 more)

### Community 5 - "Paginacao"
Cohesion: 0.13
Nodes (16): Max, Min, PaginationDto, ApiPropertyOptional, IsInt, IsOptional, CountArgs, FindManyArgs (+8 more)

### Community 6 - "Excecoes e Filtro HTTP"
Cohesion: 0.15
Nodes (14): Catch, @nestjs/throttler, BusinessException, DuplicateResourceException, ResourceNotFoundException, AllExceptionsFilter, ExceptionPayload, Captured (+6 more)

### Community 7 - "Opcoes do Compilador TypeScript"
Cohesion: 0.10
Nodes (20): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+12 more)

### Community 8 - "Dependencias de Producao"
Cohesion: 0.11
Nodes (19): dependencies, bcrypt, class-transformer, class-validator, helmet, @nestjs/common, @nestjs/config, @nestjs/core (+11 more)

### Community 9 - "Dependencias de Desenvolvimento"
Cohesion: 0.12
Nodes (17): devDependencies, eslint, jest, @nestjs/cli, @nestjs/schematics, @nestjs/testing, prettier, prisma (+9 more)

### Community 10 - "Envelope de Response"
Cohesion: 0.26
Nodes (11): isPaginated(), PaginatedPayload, resolveRequestId(), ResponseInterceptor, contextWith(), handlerOf(), intercept(), Injectable (+3 more)

### Community 11 - "Roles e Tipos do Express"
Cohesion: 0.27
Nodes (6): ROLES_KEY, Role, ADMIN, USER, Express, Request

### Community 12 - "Scripts npm"
Cohesion: 0.22
Nodes (9): scripts, build, lint, prisma:migrate, prisma:seed, start:dev, test, test:e2e (+1 more)

### Community 13 - "Configuracao do Nest CLI"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 14 - "TSConfig de Build"
Cohesion: 0.33
Nodes (5): ./tsconfig.json, compilerOptions, rootDir, exclude, extends

## Knowledge Gaps
- **120 isolated node(s):** `config`, `$schema`, `collection`, `sourceRoot`, `deleteOutDir` (+115 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 157 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@nestjs/common` connect `Decorators, Pipes e Health` to `Toolchain e Metadados do Pacote`, `Bootstrap do App e Constantes`, `Configuracao e Infra do Postgres`, `Query, Filtro e Ordenacao`, `Excecoes e Filtro HTTP`, `Envelope de Response`, `Roles e Tipos do Express`?**
  _High betweenness centrality (0.379) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Dependencias de Producao` to `Toolchain e Metadados do Pacote`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Dependencias de Desenvolvimento` to `Toolchain e Metadados do Pacote`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **What connects `config`, `$schema`, `collection` to the rest of the system?**
  _120 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Toolchain e Metadados do Pacote` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `Bootstrap do App e Constantes` be split into smaller, more focused modules?**
  _Cohesion score 0.10114942528735632 - nodes in this community are weakly interconnected._
- **Should `Configuracao e Infra do Postgres` be split into smaller, more focused modules?**
  _Cohesion score 0.11692307692307692 - nodes in this community are weakly interconnected._