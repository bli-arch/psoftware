import { describe, expect, test } from "bun:test";

import { isConnectedToLocalPServer, isLocalPServerInstalled, requireConnectedLocalPServer, requireLocalPServerIdentity } from "./localServerControl";

describe("local PServer controls", () => {
    const localId = "12345678-1234-1234-1234-123456789abc";
    const remoteId = "abcdefab-cdef-cdef-cdef-abcdefabcdef";

    test("requires an exact connected/local identity match", () => {
        expect(isConnectedToLocalPServer({ available: true, serverId: localId }, localId)).toBe(true);
        expect(isConnectedToLocalPServer({ available: true, serverId: localId }, remoteId)).toBe(false);
        expect(isConnectedToLocalPServer({ available: true, serverId: null }, localId)).toBe(false);
        expect(isConnectedToLocalPServer({ available: false, serverId: localId }, localId)).toBe(false);
        expect(isConnectedToLocalPServer(null, localId)).toBe(false);
    });

    test("distinguishes installation from authority", () => {
        expect(isLocalPServerInstalled({ available: true })).toBe(true);
        expect(isLocalPServerInstalled({ available: false })).toBe(false);
        expect(requireLocalPServerIdentity({ available: true, serverId: localId })).toBe(localId);
        expect(() => requireLocalPServerIdentity({ available: true, serverId: null })).toThrow();
        expect(() => requireConnectedLocalPServer({ available: true, serverId: localId }, remoteId))
            .toThrow("Action refusée");
    });
});
