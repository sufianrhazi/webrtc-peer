export declare class Peer {
    handler: (toSend: string) => Promise<string>;
    channel: RTCDataChannel | undefined;
    onConnectedHandler: undefined | (() => void);
    onDisconnectedHandler: undefined | (() => void);
    onMessageHandler: undefined | ((event: MessageEvent<any>) => void);
    peerConnection: RTCPeerConnection;
    iceCandidates: RTCIceCandidate[];
    iceCandidatesPromise: {
        promise: Promise<RTCIceCandidate[]>;
        resolve: (candidates: RTCIceCandidate[]) => void;
        reject: (error: any) => void;
    };
    constructor(handler: (toSend: string) => Promise<string>, options?: RTCConfiguration);
    onConnected(handler: () => void): void;
    onDisconnected(handler: () => void): void;
    onMessage(handler: (event: MessageEvent<any>) => void): void;
    start(): void;
    accept(encodedOffer: string): Promise<void>;
}
