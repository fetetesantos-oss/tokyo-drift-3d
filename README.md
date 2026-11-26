# TOKYO DRIFT 3D | Mobile (WebGL)

Jogo de corrida e drift **3D em WebGL** ambientado nas ruas noturnas de Tóquio, desenvolvido com foco em smartphones **Android e iOS** (modo horizontal **Landscape** exclusivo), controle por **giroscópio / inclinação do celular**, garagem 3D interativa e zero dependências externas.

## Recursos Principais

- **Modo Horizontal Exclusivo (Landscape):** `manifest.webmanifest` configurado em `fullscreen`/`landscape`, tentativa automática de `screen.orientation.lock('landscape')`, adaptação à rotação (`90°` e `270°/-90°`) com suporte a `safe-area-inset` e tela de aviso automática caso o aparelho fique na vertical.
- **Controle por Inclinação (Giroscópio Android & iOS):**
  - Inclinar para a esquerda/direita vira suavemente com curva progressiva e filtro passa-baixa.
  - **Sensibilidade ajustável (`0.5×–2.5×`)**, **Zona Morta Central (`0°–10°`)**, **Inversão de eixo** e botão **Calibrar Ponto Central**.
  - Compatível com o fluxo de permissão do **iOS 13+** (`DeviceOrientationEvent.requestPermission()`).
  - Fallback automático para **botões táteis na tela** e suporte completo a teclado (`WASD` / `Setas`, `Espaço` Freio de Mão, `Shift` Nitro, `C` Calibrar, `R` Reposicionar, `Esc`/`P` Pausar).
- **Física 3D de Drift & Corrida:**
  - Perda e recuperação progressiva de aderência, freio de mão, **contra-esterço**, inclinação de carroceria (roll/pitch), elevação 3D (subidas/descidas), fumaça volumétrica 3D, marcas de pneu no asfalto e Nitro recarregável no drift.
  - Pontuação por ângulo, velocidade, duração, **Apex Clips**, **Wall Tap**, **Quase Colisão (Near Miss)** e multiplicador de combo até `×8.0`.
  - Colisões 3D com guardrails, adversários com IA e tráfego noturno.
- **4 Circuitos 3D de Tóquio + Clima Dinâmico:**
  1. **Shibuya Neon Loop** — Avenidas neon, viaduto, túnel iluminado, máquinas de bebidas e curvas técnicas.
  2. **Wangan Bay Bridge** — Rodovia expressa, ponte estaiada com torres iluminadas e túnel longo.
  3. **Hakone Touge** — Serra noturna com grampos fechados, elevação íngreme, cedros, cerejeiras e portais Torii.
  4. **Daikoku PA — Meet JDM** — Pátio noturno e anel de drift cercado por carros JDM estacionados.
  - Clima selecionável: **Chuva Neon** (reflexos molhados no asfalto + chuva 3D), **Noite Limpa** e **Neblina de Tóquio**.
- **5 Carros Originais Inspirados na Cultura JDM + Garagem 3D:**
  - *Kurokaze RX-9*, *Hachi-Roku S86*, *Shogun GT-34*, *Kitsune S-150* e *Chaser V-100*.
  - Personalização 3D em tempo real: pintura + underglow, rodas, aerofólio, body kit, suspensão rebaixada, configuração de drift e upgrades mecânicos comprados com **Ienes (¥)**.
- **6 Modos de Jogo:** *Desafio de Drift*, *Circuito Urbano (3 voltas vs IA)*, *Batalha de Drift (1v1)*, *Time Attack*, *Drift Livre* e *Encontro JDM*.
- **Otimização Mobile & Áudio Procedural:**
  - Perfil gráfico adaptativo (`Auto / Alto / Médio / Leve`) que ajusta resolução (DPR) e partículas automaticamente para manter estabilidade de FPS e baixo consumo de bateria.
  - Sintetizador Web Audio 100% procedural: motor JDM por RPM, pipoco de troca de marcha, *turbo flutter*, cantada de pneu, colisões, nitro e trilha eletrônica noturna original.

## Executar Localmente

```bash
python3 -m http.server 8080
```

Abra `http://localhost:8080` no navegador (ou teste no celular via HTTPS para habilitar sensores `DeviceOrientationEvent`).

## Testes Automatizados

```bash
node tests/test_suite.mjs
```
