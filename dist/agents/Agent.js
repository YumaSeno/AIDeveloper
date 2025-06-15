"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
class Agent {
    name;
    role;
    projectRole;
    constructor(name, role, projectRole) {
        this.name = name;
        this.role = role;
        this.projectRole = projectRole;
    }
}
exports.Agent = Agent;
