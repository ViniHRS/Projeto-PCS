//Teste feito no Wokwi por Alexandre Shiota
//Link da simulação: https://wokwi.com/projects/465659878553668609
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>

// Definição dos pinos no ESP32
const int pinoDIR = 12;
const int pinoSTEP = 14;
const int pinoSERVO = 13;
const int pinoPIR = 34; // Pino conectado ao OUT do Sensor PIR

// Configurações
const int passosPorVolta = 200; 
const int tempoEspera = 3; 
const int anguloServoX = 90; 

// Limite "Y": O sensor precisa detectar movimento por mais de 800ms
// durante o intervalo para ser considerado "variação suficiente"
const unsigned long limiteVariacaoY = 800; 

// Inicialização dos objetos
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo meuServo;

void setup() {
  pinMode(pinoDIR, OUTPUT);
  pinMode(pinoSTEP, OUTPUT);
  pinMode(pinoPIR, INPUT);
  
  meuServo.attach(pinoSERVO);
  meuServo.write(0);
  
  lcd.init();
  lcd.backlight();
  atualizarPainel(0, "Aguardando...");
  
  Serial.begin(115200); 
  Serial.println("Sistema PIR Ativo (Stepper + Servo + PIR). Digite de 1 a 6:");
}

void loop() {
  if (Serial.available() > 0) {
    char caractereLido = Serial.read();
    
    if (caractereLido >= '1' && caractereLido <= '6') {
      int numero = caractereLido - '0';
      int anguloDesejado = 0;
      bool sentidoHorario = true;
      
      // Regras de menu para o Stepper
      if (numero >= 1 && numero <= 4) {
        anguloDesejado = 60 * (numero - 1);
        sentidoHorario = true;
      } 
      else if (numero >= 5 && numero <= 6) {
        anguloDesejado = 60 * (7 - numero);
        sentidoHorario = false;
      }
      
      int passosAlvo = (anguloDesejado * passosPorVolta) / 360;
      
      // --- PASSO 1: MOVIMENTO DE IDA DO STEPPER ---
      if (anguloDesejado > 0) {
        Serial.print("Stepper movendo para ");
        Serial.print(anguloDesejado);
        Serial.println(" graus...");
        atualizarPainel(anguloDesejado, "Stepper indo...");
        darPassos(sentidoHorario, passosAlvo);
      } else {
        Serial.println("Numero 1 selecionado. Stepper estavel em 0 graus.");
      }
      
      // Variáveis para calcular o tempo acumulado de movimento no PIR
      unsigned long tempoTotalMovimento = 0;
      unsigned long inicioDeteccaoAtual = 0;
      bool detectandoAgora = false;

      // --- PASSO 2: ATIVAR SERVO E MONITORAR O SENSOR PIR ---
      Serial.print("Ativando Servo para ");
      Serial.print(anguloServoX);
      Serial.println(" graus.");
      atualizarPainel(anguloDesejado, "Servo Ativo (X)");
      
      meuServo.write(anguloServoX); // Gira o servo para a posição X
      
      // Laço de monitoramento ativo durante o intervalo de tempo do servo
      unsigned long tempoInicioInterv = millis();
      while (millis() - tempoInicioInterv < (tempoEspera * 1000)) {
        
        bool leituraPIR = digitalRead(pinoPIR); // Lê se há presença física (HIGH)
        
        if (leituraPIR && !detectandoAgora) {
          // O sensor acabou de detectar o início de um movimento
          inicioDeteccaoAtual = millis();
          detectandoAgora = true;
        } 
        else if (!leituraPIR && detectandoAgora) {
          // O movimento parou, calcula quanto tempo durou essa janela
          tempoTotalMovimento += (millis() - inicioDeteccaoAtual);
          detectandoAgora = false;
        }
        
        delay(10); // Amostragem de alta frequência (10ms)
      }
      
      // Caso o sensor ainda estivesse ativo quando o tempo do loop acabou
      if (detectandoAgora) {
        tempoTotalMovimento += (millis() - inicioDeteccaoAtual);
      }

      // --- PASSO 3: ANALISAR VARIAÇÃO DO SENSOR (Se > Y) ---
      Serial.print("Tempo total de movimento detectado: ");
      Serial.print(tempoTotalMovimento);
      Serial.println(" ms");
      
      lcd.clear();
      lcd.setCursor(0, 0);
      if (tempoTotalMovimento > limiteVariacaoY) {
        Serial.println("Remédio caiu!");
        lcd.print("PIR: Alerta (>Y)");
      } else {
        Serial.println("ERRO! Remédio não caiu");
        Serial.println("Verifique se há Remédio ou se houve Erro Mecânico");
        delay(3000);
        Serial.println("Erro solucionado? [S/N]");
        char character = Serial.read();
        while(character!='S' && character!='N'){
          character = Serial.read();
        }
        int attempt = 1;
        while(character=='N'){
          Serial.print("Erro solucionado?(");
          Serial.print(attempt);
          Serial.println(")");
          attempt++;
          delay(2000);
          character = Serial.read();
          while(character!='S' && character!='N'){
            character = Serial.read();
          }
        }

        lcd.print("PIR: Sem variacao");
      }
      lcd.setCursor(0, 1);
      lcd.print("Mov: ");
      lcd.print(tempoTotalMovimento);
      lcd.print(" ms");
      
      delay(2500); // Exibe o veredito por 2.5 segundos
      
      // --- PASSO 4: RETORNO DO SISTEMA AO ESTADO INICIAL ---
      Serial.println("Resetando Servo para 0 graus...");
      meuServo.write(0);
      delay(500);
      
      if (anguloDesejado > 0) {
        Serial.println("Stepper retornando para a posicao zero...");
        atualizarPainel(anguloDesejado, "Stepper voltando");
        darPassos(!sentidoHorario, passosAlvo); 
      }
      
      atualizarPainel(0, "Pronto / No Zero");
      Serial.println("Pronto no ponto zero! Digite outro numero.\n");
    }
  }
}

void darPassos(bool horario, int passos) {
  digitalWrite(pinoDIR, horario ? HIGH : LOW);
  for (int i = 0; i < passos; i++) {
    digitalWrite(pinoSTEP, HIGH);
    delayMicroseconds(2000); 
    digitalWrite(pinoSTEP, LOW);
    delayMicroseconds(2000);
  }
}

void atualizarPainel(int angulo, String status) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Angulo: ");
  lcd.print(angulo);
  lcd.print((char)223); 
  
  lcd.setCursor(0, 1);
  lcd.print(status);
}
