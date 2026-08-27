# Liferay Frontend Engineer Exercise

## General Questions

- What best practices have you used to ensure that the front-end of your websites is as fast as possible?
  - Separate the responsibilities of each component, avoiding unnecessary re-renders and loading to the user only whats necessary at first, leaving background tasks to load the rest of the content. That can be achieved by using lazy loading, modular architecture, keeping state localized, loading techniques, pagination and assets optimization.
- Describe your preferred new (or under active specification) JS feature.
  - My preferred JavaScript feature under active specification is pattern matching, currently at TC39 Stage 2.

    It introduces a declarative syntax that combines value matching, type checking, and object destructuring in a single control structure. This provides a cleaner alternative to traditional `if`/`else` chains and rigid `switch` statements.

    In daily development, handling API responses often means managing diverse HTTP status codes, varying error payloads, or changing object shapes. Pattern matching would allow us to validate status codes and extract nested data at the same time, using only a few lines of code.

    I particularly like that it makes branching based on payload formats or values explicit, reduces boilerplate, and makes error handling more predictable and readable.

- What are a few of your least favorite things about JavaScript? Explain why.
  - My least favorite aspect of JavaScript is its limited native support for structuring and enforcing contracts in large Object-Oriented Programming (OOP) codebases.

    My concern is that the language has historically provided fewer built-in tools for encapsulation, abstraction, and type-safe polymorphism. For example, it did not originally provide native private members, abstract classes, interfaces, or method overloading based on parameter types. The `class` syntax introduced in ES6 makes OOP code more familiar, but it does not add most of these features at the language level.

    Recent JavaScript standards have introduced native private fields, such as `#field`, but TypeScript addresses many of the remaining challenges by adding static typing, interfaces, access modifiers such as `private`, `protected`, and `public`, and abstract classes. These features make it easier to define clear contracts and apply robust OOP design patterns when building large-scale applications.
