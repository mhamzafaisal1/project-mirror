// import { Component, OnInit, OnDestroy, Input } from '@angular/core';
// import { Injectable } from '@angular/core';
// import { Observable } from 'rxjs/internal/Observable';
// import { MachineMaster } from './shared/models/machine-master.model';
// import { MachineActive } from './shared/models/machine-active.model';
// import { HttpClient } from '@angular/common/http';
// import { MachineDetailItem } from './shared/models/machine-detail-item.model';
// import { MachineDetailFaultSummary } from './shared/models/machine-detail-faultsummary.model';
// import { MachineDetailFaultHistory } from './shared/models/machine-detail-faulthistory.model';
// import { MachineFloorPodItem } from './shared/models/machine-floor-pod.model';
// import { MachineAvailability } from './shared/models/machine-availability.model';
// import { MachineThroughput } from './shared/models/machine-throughput.model';
// import { MachineEfficiency } from './shared/models/machine-efficiency.model';
// @Injectable({
//     providedIn: 'root'
// })
// export class MachineService {

//     constructor(private http: HttpClient) { }

//     public getMachineTicker(serialNumber: string): Observable<any> {
//         return this.http.get<any>('http://dev.chidry.com:9090/api/machine/ticker/' + serialNumber + '/');
//     }
//     public getLaneRealtime(serialNumber: string, lane: string, timeframe: string): Observable<any> {
//         return this.http.get<any>('http://dev.chidry.com:9090/api/operator/realtime/' + serialNumber + '/' + lane + '/' + timeframe + '/');
//     }

//     public getMachineMaster(): Observable<MachineMaster[]> {
//         return this.http.get<MachineMaster[]>('../assets/mocks/data/machinemaster.json');
//     }
//     public getActiveMachines(machineType: string): Observable<MachineActive[]> {
//         return this.http.get<MachineActive[]>('http://dev.chidry.com:9090/api/machines/active/' + machineType + '/');
//     }
//     public getMachineDetailItemGridByMachineName(machine: string): Observable<MachineDetailItem[]> {
//         return this.http.get<MachineDetailItem[]>('../assets/mocks/data/machinedetailitem' + machine + '.json/');
//     }
//     public getMachineDetailFaultSummaryGridByMachineName(machine: string): Observable<MachineDetailFaultSummary[]> {
//         return this.http.get<MachineDetailFaultSummary[]>('../assets/mocks/data/machinedetailfaultsummary.json');
//     }
//     public getMachineDetailFaultHistoryGridByMachineName(machine: string): Observable<MachineDetailFaultHistory[]> {
//         return this.http.get<MachineDetailFaultHistory[]>('../assets/mocks/data/machinedetailfaulthistory.json');
//     }
//     public getMachineFloorPodItems(): Observable<MachineFloorPodItem[]> {
//         return this.http.get<MachineFloorPodItem[]>('../assets/mocks/data/machinefloorpoditems.json');
//     }
//     public getMachineAvailability(timeframe: string, machine: string): Observable<MachineAvailability> {
//         return this.http.get<MachineAvailability>('http://dev.chidry.com:9090/api/machine/machineAvailability/' + timeframe + '/' + machine + '/');
//     }
//     public getMachineThroughput(timeframe: string, machine: string): Observable<MachineThroughput> {
//         return this.http.get<MachineThroughput>('http://dev.chidry.com:9090/api/machine/machineThroughput/' + timeframe + '/' + machine + '/');
//     }
//     public getMachineEfficiency(timeframe: string, machine: string): Observable<MachineEfficiency> {
//         return this.http.get<MachineEfficiency>('http://dev.chidry.com:9090/api/machine/machineEfficiency/' + timeframe + '/' + machine + '/');
//     }
// }