export const STR = {
  pt: {
    title: 'PHEV por dentro', subtitle: 'Simulador de recarga, diagnóstico OBD-II e multimídia',
    tabs: { overview: 'Visão geral', charging: 'Recarga', obd: 'OBD-II', hu: 'Multimídia' },
    tour: 'Tour guiado', tourStop: 'Parar tour', tech: 'Modo técnico', xray: 'Raio-X', lang: 'EN',
    panel: 'Configurações', reset: 'Reiniciar',
    g: { version: 'Versão', color: 'Cor', timeScale: 'Velocidade da simulação', quality: 'Qualidade gráfica', qHigh: 'Alta', qMed: 'Média', qLow: 'Leve' },
    colors: { silver: 'Prata', blue: 'Azul', white: 'Branco', graphite: 'Grafite' },
    c: {
      source: 'Fonte de energia', none: 'Desconectado', portable: 'Tomada 220 V', wallbox: 'Wallbox', dc: 'Carregador DC',
      dcPower: 'Potência do carregador DC', limit: 'Limite de recarga', soc: 'Estado de carga', ambient: 'Temperatura ambiente',
      driving: 'Em movimento', drivingHint: 'Desconecte o carregador para dirigir', mode: 'Modo de condução', ev: 'Elétrico', hybrid: 'Híbrido', charge: 'Recarga em movimento',
      speed: 'Velocidade', regen: 'Regeneração', low: 'Baixa', medium: 'Média', high: 'Alta', brake: 'Segure para frear'
    },
    o: {
      requests: 'Leituras em ciclo', std: 'Padronizadas (SAE J1979, modo 01)', uds: 'Do fabricante (UDS 0x22, ilustrativas)',
      rate: 'Taxa de leitura', actions: 'Comandos', vin: 'Ler VIN', read: 'Ler falhas (03)', clear: 'Apagar falhas (04)',
      gateway: 'Gateway bloqueia dados do fabricante', fault: 'Simular falha', fNone: 'Nenhuma', fIso: 'Isolamento de alta tensão', fDeg: 'Bateria degradada', fCell: 'Tensão de célula baixa',
      results: 'Últimas respostas', busLoad: 'Carga do barramento (estimada)'
    },
    pid: { speed: 'Velocidade', rpm: 'Rotação do motor', hybBatt: 'Bateria híbrida, carga restante', coolant: 'Líquido de arrefecimento', fuel: 'Nível de combustível', ambient: 'Temperatura externa',
      udsSoc: 'SoC real', udsVolt: 'Tensão do pack', udsCurr: 'Corrente do pack', udsTemp: 'Temperatura do pack', udsCells: 'Célula mín. / máx.' },
    h: {
      signals: 'Sinais liberados pelo gateway', sSoc: 'Estado de carga', sPower: 'Potência', sSpeed: 'Velocidade', sCharge: 'Recarga', sTemp: 'Temperatura da bateria',
      period: 'Período da mensagem da BMS', zoom: 'Ampliar tela da central', close: 'Fechar', vhal: 'Propriedades no Android Automotive', latency: 'Atraso até a tela',
      limitWrite: 'Limite definido na central', limitHint: 'Ao mover, a central grava EV_CHARGE_PERCENT_LIMIT e a BMS passa a respeitar o novo limite.'
    },
    hud: { soc: 'Estado de carga', power: 'Potência na bateria', speed: 'Velocidade', state: 'Estado', temp: 'Temperatura do pack', tts: 'Até o limite', range: 'Autonomia elétrica', fuel: 'Combustível', engine: 'Motor 1.5' },
    st: { idle: 'Parado', charging: 'Recarregando', done: 'Limite atingido', fault: 'Recarga bloqueada', evDrive: 'Elétrico', series: 'Motor gerando energia', parallel: 'Motor e elétrico nas rodas', regen: 'Regenerando', coast: 'Em movimento' },
    on: 'ligado', off: 'desligado', simulated: 'Valores simulados',
    lbl: {
      batt: ['Bateria de alta tensão', 'LFP · {cap} kWh'], obc: ['Carregador de bordo', 'AC → DC · 6,6 kW'], port: ['Porta de recarga', 'AC Tipo 2 e DC CCS2'], wallbox: ['Wallbox', '220 V · 32 A'], portable: ['Carregador portátil', '220 V · 10 A'], dc: ['Carregador rápido DC', 'até {kw} kW'],
      motor: ['Motor elétrico de tração', '160 kW · 262 Nm'], gen: ['Gerador', 'Transmissão híbrida dedicada'], inv: ['Eletrônica de potência', 'Inversor e conversor DC/DC'], engine: ['Motor 1.5', 'Combustão, aspirado'], tank: ['Tanque', 'Gasolina ou etanol'],
      bms: ['BMS', 'Gerenciamento da bateria'], vcu: ['VCU', 'Controle do veículo'], gw: ['Gateway', 'Separa e filtra as redes CAN'], obd: ['Conector OBD-II', 'SAE J1962, sob o painel'], dongle: ['Dongle de telemetria', 'Lê a CAN e envia pela rede'], hu: ['Central multimídia', 'Android Automotive'], cable: ['Cabos de alta tensão', 'Cor laranja por norma']
    },
    ex: {
      overview: ['Um SUV híbrido plug-in por dentro', 'A bateria de alta tensão fica sob o assoalho. Na frente estão o motor elétrico de tração, o gerador e o motor 1.5 a combustão. Escolha um módulo acima para simular a recarga, ler dados pela porta OBD-II ou acompanhar o caminho dos sinais até a central multimídia.'],
      ac: ['Recarga em corrente alternada', 'A energia chega em AC. O carregador de bordo converte para DC e limita a potência em 6,6 kW, mesmo que o wallbox ofereça mais. A BMS acompanha tensão, corrente e temperatura e reduz a corrente perto do fim.'],
      portable: ['Recarga na tomada comum', 'Com o carregador portátil a potência cai para cerca de 2,2 kW. Funciona em qualquer tomada adequada, mas leva várias horas para completar a bateria.'],
      dc: ['Recarga rápida em corrente contínua', 'No DC o carregador externo faz a conversão e a energia vai direto para a bateria, sem passar pelo carregador de bordo. A potência cai acima de 80% e também com a bateria fria ou quente demais.'],
      done: ['Limite de recarga atingido', 'A BMS encerrou a recarga no limite definido. Limitar a carga máxima ajuda a preservar a bateria no uso diário.'],
      fault: ['Recarga bloqueada por segurança', 'A resistência de isolamento da alta tensão ficou abaixo do mínimo. A BMS abre os contatores, registra a falha P0AA6 e acende a luz de anomalia no painel.'],
      evDrive: ['Tração elétrica', 'A bateria alimenta o motor elétrico pelo inversor. O motor a combustão fica desligado.'],
      series: ['Motor a combustão como gerador', 'O motor 1.5 gira o gerador. A energia alimenta o motor de tração e o excedente recarrega a bateria, sem que o motor a combustão mova as rodas.'],
      parallel: ['Motor a combustão nas rodas', 'Em velocidade de estrada a transmissão híbrida acopla o motor 1.5 às rodas, junto com o motor elétrico. É o modo mais eficiente nessa faixa.'],
      regen: ['Frenagem regenerativa', 'Ao aliviar o acelerador ou frear, o motor elétrico vira gerador e devolve energia à bateria. Quanto maior o nível de regeneração, mais forte a desaceleração.'],
      idle: ['Pronto para rodar', 'Defina uma velocidade para dirigir ou conecte uma fonte de energia para recarregar.'],
      obd: ['Diagnóstico pela porta OBD-II', 'O dongle pergunta pela rede CAN e a unidade responsável responde. Os PIDs do modo 01 têm formato padronizado. Dados como SoC real e tensão das células usam identificadores próprios de cada fabricante, lidos com o serviço UDS 0x22.'],
      obdBlocked: ['Gateway de segurança ativo', 'O gateway recusa leituras dos identificadores do fabricante e a unidade responde com o código negativo 0x33. Apenas os dados padronizados continuam acessíveis pela porta.'],
      obdFault: ['Falha registrada', 'Com uma falha ativa, o modo 03 retorna o código de diagnóstico. O modo 04 apaga o registro, mas ele volta enquanto a causa persistir.'],
      hu: ['Dos quadros CAN à tela', 'As ECUs publicam quadros periódicos. O gateway repassa apenas os sinais autorizados para a rede de infotainment. Na central, o Vehicle HAL do Android Automotive converte esses sinais em propriedades que os aplicativos assinam.'],
      huBlocked: ['Sinal retido no gateway', 'Um sinal bloqueado não chega à central e a tela mostra o campo vazio. É assim que os fabricantes controlam quais dados os aplicativos podem ver.']
    },
    tourSteps: [
      'Visão geral do veículo', 'Recarga em wallbox AC', 'Recarga rápida DC', 'Frenagem regenerativa', 'Motor a combustão como gerador',
      'Conector OBD-II', 'PIDs padronizados', 'Dados do fabricante via UDS', 'Leitura de falhas', 'Quadros periódicos na rede', 'Sinais retidos no gateway', 'Propriedades na central'
    ]
  },
  en: {
    title: 'Inside a PHEV', subtitle: 'Charging, OBD-II diagnostics and infotainment simulator',
    tabs: { overview: 'Overview', charging: 'Charging', obd: 'OBD-II', hu: 'Infotainment' },
    tour: 'Guided tour', tourStop: 'Stop tour', tech: 'Technical mode', xray: 'X-ray', lang: 'PT',
    panel: 'Settings', reset: 'Reset',
    g: { version: 'Trim', color: 'Paint', timeScale: 'Simulation speed', quality: 'Graphics quality', qHigh: 'High', qMed: 'Medium', qLow: 'Light' },
    colors: { silver: 'Silver', blue: 'Blue', white: 'White', graphite: 'Graphite' },
    c: {
      source: 'Power source', none: 'Unplugged', portable: '220 V outlet', wallbox: 'Wallbox', dc: 'DC charger',
      dcPower: 'DC charger power', limit: 'Charge limit', soc: 'State of charge', ambient: 'Ambient temperature',
      driving: 'On the road', drivingHint: 'Unplug the charger to drive', mode: 'Drive mode', ev: 'Electric', hybrid: 'Hybrid', charge: 'Charge while driving',
      speed: 'Speed', regen: 'Regeneration', low: 'Low', medium: 'Medium', high: 'High', brake: 'Hold to brake'
    },
    o: {
      requests: 'Polled readings', std: 'Standard (SAE J1979, mode 01)', uds: 'Manufacturer (UDS 0x22, illustrative)',
      rate: 'Polling rate', actions: 'Commands', vin: 'Read VIN', read: 'Read DTCs (03)', clear: 'Clear DTCs (04)',
      gateway: 'Gateway blocks manufacturer data', fault: 'Simulate fault', fNone: 'None', fIso: 'HV isolation fault', fDeg: 'Degraded battery', fCell: 'Low cell voltage',
      results: 'Latest responses', busLoad: 'Bus load (estimated)'
    },
    pid: { speed: 'Vehicle speed', rpm: 'Engine speed', hybBatt: 'Hybrid battery remaining', coolant: 'Coolant temperature', fuel: 'Fuel level', ambient: 'Ambient temperature',
      udsSoc: 'True SoC', udsVolt: 'Pack voltage', udsCurr: 'Pack current', udsTemp: 'Pack temperature', udsCells: 'Cell min / max' },
    h: {
      signals: 'Signals forwarded by the gateway', sSoc: 'State of charge', sPower: 'Power', sSpeed: 'Speed', sCharge: 'Charging', sTemp: 'Battery temperature',
      period: 'BMS message period', zoom: 'Enlarge head unit screen', close: 'Close', vhal: 'Android Automotive properties', latency: 'Delay to screen',
      limitWrite: 'Limit set on the head unit', limitHint: 'Moving it writes EV_CHARGE_PERCENT_LIMIT and the BMS adopts the new limit.'
    },
    hud: { soc: 'State of charge', power: 'Battery power', speed: 'Speed', state: 'State', temp: 'Pack temperature', tts: 'To limit', range: 'Electric range', fuel: 'Fuel', engine: '1.5 engine' },
    st: { idle: 'Parked', charging: 'Charging', done: 'Limit reached', fault: 'Charging blocked', evDrive: 'Electric', series: 'Engine generating', parallel: 'Engine and motor driving', regen: 'Regenerating', coast: 'Moving' },
    on: 'on', off: 'off', simulated: 'Simulated values',
    lbl: {
      batt: ['High-voltage battery', 'LFP · {cap} kWh'], obc: ['On-board charger', 'AC → DC · 6.6 kW'], port: ['Charge port', 'AC Type 2 and DC CCS2'], wallbox: ['Wallbox', '220 V · 32 A'], portable: ['Portable charger', '220 V · 10 A'], dc: ['DC fast charger', 'up to {kw} kW'],
      motor: ['Traction motor', '160 kW · 262 Nm'], gen: ['Generator', 'Dedicated hybrid transmission'], inv: ['Power electronics', 'Inverter and DC/DC converter'], engine: ['1.5 engine', 'Naturally aspirated'], tank: ['Fuel tank', 'Gasoline or ethanol'],
      bms: ['BMS', 'Battery management'], vcu: ['VCU', 'Vehicle control unit'], gw: ['Gateway', 'Separates and filters CAN networks'], obd: ['OBD-II connector', 'SAE J1962, under the dash'], dongle: ['Telematics dongle', 'Reads CAN, sends over the network'], hu: ['Head unit', 'Android Automotive'], cable: ['High-voltage cables', 'Orange by standard']
    },
    ex: {
      overview: ['A plug-in hybrid SUV, inside', 'The high-voltage battery sits under the floor. Up front are the traction motor, the generator and the 1.5 combustion engine. Pick a module above to simulate charging, read data through the OBD-II port or follow signals to the head unit.'],
      ac: ['AC charging', 'Energy arrives as AC. The on-board charger converts it to DC and caps power at 6.6 kW, even when the wallbox could supply more. The BMS watches voltage, current and temperature and tapers current near the end.'],
      portable: ['Charging from a regular outlet', 'With the portable charger power drops to about 2.2 kW. It works on any suitable outlet but takes several hours to fill the battery.'],
      dc: ['DC fast charging', 'With DC the external charger does the conversion and energy goes straight to the battery, bypassing the on-board charger. Power tapers above 80% and when the battery is too cold or too hot.'],
      done: ['Charge limit reached', 'The BMS ended the session at the configured limit. Capping the maximum charge helps preserve the battery in daily use.'],
      fault: ['Charging blocked for safety', 'High-voltage isolation resistance dropped below the minimum. The BMS opens the contactors, stores DTC P0AA6 and lights the malfunction lamp.'],
      evDrive: ['Electric drive', 'The battery powers the traction motor through the inverter. The combustion engine stays off.'],
      series: ['Engine as a generator', 'The 1.5 engine spins the generator. Its energy feeds the traction motor and the surplus recharges the battery, without the engine driving the wheels.'],
      parallel: ['Engine driving the wheels', 'At highway speed the hybrid transmission couples the 1.5 engine to the wheels alongside the electric motor. It is the most efficient mode in that range.'],
      regen: ['Regenerative braking', 'When you lift off or brake, the motor becomes a generator and returns energy to the battery. Higher regeneration means stronger deceleration.'],
      idle: ['Ready to drive', 'Set a speed to drive or connect a power source to charge.'],
      obd: ['Diagnostics through the OBD-II port', 'The dongle asks over the CAN bus and the responsible unit answers. Mode 01 PIDs have a standard format. Data such as true SoC and cell voltages use manufacturer identifiers read with UDS service 0x22.'],
      obdBlocked: ['Security gateway active', 'The gateway refuses manufacturer identifiers and the unit answers with negative response code 0x33. Only standardized data remain accessible through the port.'],
      obdFault: ['Fault stored', 'With an active fault, mode 03 returns the diagnostic code. Mode 04 clears it, but it returns while the cause persists.'],
      hu: ['From CAN frames to the screen', 'ECUs publish periodic frames. The gateway forwards only authorized signals to the infotainment network. In the head unit, the Android Automotive Vehicle HAL turns them into properties that apps subscribe to.'],
      huBlocked: ['Signal held at the gateway', 'A blocked signal never reaches the head unit, so the screen shows an empty field. This is how manufacturers control which data apps can see.']
    },
    tourSteps: [
      'Vehicle overview', 'AC wallbox charging', 'DC fast charging', 'Regenerative braking', 'Engine as a generator',
      'OBD-II connector', 'Standard PIDs', 'Manufacturer data over UDS', 'Reading faults', 'Periodic frames on the bus', 'Signals held at the gateway', 'Properties on the head unit'
    ]
  }
};
