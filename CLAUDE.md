- add comment documentation on each class and method definition inside classes
  - brief and short, straightforward easy to understand comments
  - no comment documentation on the following:
    - entities
    - repositories
    - repository methods

Refer to [Role.java](src/main/java/dev/tjj/easi/entity/Role.java) when doing anything about roles or authorization. 

Add appropriate jakarta.validation for all DTO and ensure input are validated in controllers with @Valid