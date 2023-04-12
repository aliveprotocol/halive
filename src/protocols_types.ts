type ProtocolIDMap = {
    [key: string]: number
}

type ProtocolDefaults = {
    [key: string]: string
}

export type ProtocolObj = {
    map: {
        storage: ProtocolIDMap
        l2: ProtocolIDMap
    }
    defaults: ProtocolDefaults
    retrieveMap: () => Promise<void>
}