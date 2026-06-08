/*
Código do circuito físico de teste da CIDRA
Objetivo do teste: girar ambos os motores e testar o sensor IR de distância
Teste feito por Vinícius Sakuma
*/
#include <Stepper.h>
#include <ESP32Servo.h>

// Definição dos pinos no ESP32
#define pinoServo 18
#define pinoIR 34
#define greenLed 33
#define redLed 32
#define IN1 19
#define IN2 21
#define IN3 22
#define IN4 23

// Configurações
const int passosPorVolta = 2048; // Passos por volta do motor 28BYJ-48
#define anguloServo 60

// Inicialização dos objetos
Servo meuServo;

Stepper motor(
  passosPorVolta,
  IN1, IN3, IN2, IN4
);

void setup() {
  Serial.begin(115200);

  pinMode(greenLed, OUTPUT); // GPIO 33
  pinMode(redLed, OUTPUT); // GPIO 32
  pinMode(pinoIR, INPUT); // GPIO 34
  
  meuServo.attach(pinoServo); // GPIO 18
  meuServo.write(180);

  motor.setSpeed(15); //RPM
}

void loop() {

  int estado = digitalRead(pinoIR);

  if (estado == HIGH) {
    Serial.println("Nenhum remédio dispensado");
    //Led indicador
    digitalWrite(greenLed, LOW);
    digitalWrite(redLed, HIGH);
    delay(1000);
    //Movendo o motor de passo para selecionar o remédio
    motor.step(passosPorVolta/4); //Move 90°
    delay(1000);
    //Movendo o servo motor para pegar o remédio
    for (int ang = 0; ang <= anguloServo; ang++) {
      meuServo.write(180-ang);
      delay(15);
    }
    delay(500);
    //Movendo o servo motor para dispensar o remédio
    for (int ang = anguloServo; ang >= 0; ang--) {
      meuServo.write(180-ang);
      delay(15);
    }
    delay(500);
    //Movendo o motor de passo para a posição inicial
    motor.step(-passosPorVolta/4); //Move 90°
    delay(1000);
  }
  else {
    Serial.println("Remédio já foi dispensado");
    digitalWrite(greenLed, HIGH);
    digitalWrite(redLed, LOW);
  }
}
