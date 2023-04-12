export type FK_TYPE = {
    table: string
    fk: string
    ref: string
}

export type FKS_TYPE = {
    [key: string]: FK_TYPE
}