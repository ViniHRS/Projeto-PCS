#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include <Stepper.h>
#include <Preferences.h>
#include <time.h>

// ================= GPIOs =================
#define pinoServo 18
#define pinoIR 34
#define greenLed 4

#define IN1 19
#define IN2 21
#define IN3 22
#define IN4 23

// ================= CONFIGURAÇÕES =================
const int passosPorVolta = 2048;
const int passosPorSlot = 256; 
const int anguloServo = 50;
const int maxAgendamentos = 60; // Expandido para comportar a decomposição por dias da semana

// ================= WIFI =================
const char* ssid = "AndroidAPA051";
const char* password = "jwyg8115";

// ================= MQTT =================
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char* topicoComando = "cidra/caixa/comando";
const char* topicoConfirmacao = "cidra/hardware/confirmacao";

// ================= NTP =================
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = -3 * 3600;
const int daylightOffset_sec = 0;

// ================= OBJETOS =================
WiFiClient espClient;
PubSubClient client(espClient);
Servo meuServo;
Stepper motor(passosPorVolta, IN1, IN3, IN2, IN4);
Preferences preferences;

// ================= ESTRUTURA REFORMULADA COM DOSE =================
struct Agendamento {
  int dia;
  int hora;
  int minuto;
  int slot;
  String idMensagem;
  int dose; // Quantidade de vezes que deve ejetar (Item a)
};

Agendamento agenda[maxAgendamentos];
int totalAgendamentos = 0;
String ultimoIdProcessado = ""; 
unsigned long ultimoTempoVerificacao = 0;
const long intervaloVerificacao = 5000; 

void parseAgenda(String payload);

void conectarWiFi() {
  Serial.print("Conectando WiFi");
  WiFi.begin(ssid, password);
  
  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 30) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }
  
  if(WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi conectado!");
  } else {
    Serial.println("\nFalha crítica de WiFi.");
  }
}

void conectarNTP() {
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  struct tm timeinfo;
  int tentativas = 0;
  while (!getLocalTime(&timeinfo) && tentativas < 10) {
    Serial.println("Sincronizando horário...");
    delay(1000);
    tentativas++;
  }
}

void salvarAgendaFlash(String payload) {
  preferences.begin("agenda", false);
  preferences.putString("dados", payload);
  preferences.end();
}

void carregarAgendaFlash() {
  preferences.begin("agenda", true);
  String dados = preferences.getString("dados", "");
  preferences.end();

  if (dados.length() > 0) {
    Serial.println("Carregando agenda da Flash...");
    parseAgenda(dados);
  }
}

void parseAgenda(String payload) {
  totalAgendamentos = 0;
  
  while (payload.length() > 0 && totalAgendamentos < maxAgendamentos) {
    int pontoVirgula = payload.indexOf(';');
    String linha;

    if (pontoVirgula == -1) {
      linha = payload;
      payload = "";
    } else {
      linha = payload.substring(0, pontoVirgula);
      payload = payload.substring(pontoVirgula + 1);
    }

    linha.trim();
    if (linha.length() == 0) continue;

    String valores[6];
    // Expandido para 6 tokens: dia,hora,min,slot,id,dose
    int indice = 0;
    while (linha.length() > 0 && indice < 6) {
      int virgula = linha.indexOf(',');
      if (virgula == -1) {
        valores[indice++] = linha;
        break;
      }
      valores[indice++] = linha.substring(0, virgula);
      linha = linha.substring(virgula + 1);
    }

    // Processamento seguro aceitando comandos de 5 (legado) ou 6 parâmetros (com dose dinãmica)
    if (indice >= 5) {
      String idMensagemRecebida = valores[4];
      idMensagemRecebida.trim();

      if (idMensagemRecebida.length() > 0 && idMensagemRecebida == ultimoIdProcessado && indice == 5) {
        Serial.println("Bloqueio Lógico Ativado: Ignorando mensagem duplicada de mesmo ID.");
        if (client.connected()) {
          client.publish(topicoConfirmacao, "{\"status\":\"erro\",\"motivo\":\"mensagem_duplicada_bloqueada\"}");
        }
        return; 
      }

      agenda[totalAgendamentos].dia = valores[0].toInt();
      agenda[totalAgendamentos].hora = valores[1].toInt();
      agenda[totalAgendamentos].minuto = valores[2].toInt();
      agenda[totalAgendamentos].slot = valores[3].toInt();
      agenda[totalAgendamentos].idMensagem = idMensagemRecebida;

      // Se a dose foi especificada no 6º parâmetro, salva. Caso contrário define dose padrão = 1
      if(indice == 6) {
         agenda[totalAgendamentos].dose = valores[5].toInt();
      } else {
         agenda[totalAgendamentos].dose = 1;
      }
      
      if(indice == 5) {
         ultimoIdProcessado = idMensagemRecebida;
      }
      
      totalAgendamentos++;
    } else {
      Serial.println("Erro: Linha de comando mal formatada.");
    }
  }

  Serial.print("Agendamentos ativos no Hardware: ");
  Serial.println(totalAgendamentos);
}

void callback(char* topic, byte* payload, unsigned int length) {
  String mensagem = "";
  for (int i = 0; i < length; i++) {
    mensagem += (char)payload[i];
  }
  Serial.println("\nComando de Configuração Atualizado Recebido:");
  Serial.println(mensagem);

  salvarAgendaFlash(mensagem);
  parseAgenda(mensagem);
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Conectando MQTT...");
    String clientId = "ESP32Medic_";
    clientId += String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("Conectado!");
      client.subscribe(topicoComando);
    } else {
      Serial.print("Falha. Código: ");
      Serial.print(client.state());
      Serial.println(" Retentando em 5s...");
      delay(5000);
    }
  }
}

void moverServo() {
  for (int ang = 0; ang <= anguloServo; ang++) {
    meuServo.write(180 - ang);
    delay(15);
  }
  delay(500);
  for (int ang = anguloServo; ang >= 0; ang--) {
    meuServo.write(180 - ang);
    delay(15);
  }
  delay(500);
}

// EXECUTA A DISPENSAÇÃO REPETIDA "DOSE" VEZES COM ANÁLISE DE FALHA (Item a / f / g)
void dispensarRemedio(int slot, String idTransacao, int totalDoses) {
  Serial.printf("Executando dispensacao do slot: %d | Total de Doses: %d\n", slot, totalDoses);
  digitalWrite(greenLed, LOW);

  int deslocamento = slot - 1;
  if (deslocamento > 4) deslocamento -= 8;
  int passos = deslocamento * passosPorSlot;

  bool erroMecanicoDetectado = false;
  
  // Gira o motor e o servo repetidamente de acordo com a dose do medicamento (Item a)
  for (int d = 0; d < totalDoses; d++) {
    Serial.printf("Liberando dose %d de %d...\n", d + 1, totalDoses);
    motor.step(passos);
    delay(800);
    moverServo();

    // Leitura do Sensor Óptico/Infravermelho de queda (Item f)
    int estadoIR = digitalRead(pinoIR);
    
    // Se em qualquer uma das doses o sensor falhar (ficar em HIGH), aborta e gera erro
    if (estadoIR != LOW) { 
      erroMecanicoDetectado = true;
      Serial.println("🚨 Falha física detectada por falta de passagem de objeto!");
      motor.step(-passos); // Retorna motor para posição segura antes de disparar erro
      break;
    }

    delay(500);
    motor.step(-passos); 
    delay(800);
  }

  // Envio de feedback estruturado em formato JSON via MQTT para o Frontend
  String respostaJson = "{\"id\":\"" + idTransacao + "\",\"slot\":" + String(slot);
  
  if (!erroMecanicoDetectado) {
    Serial.println("✓ Sucesso Completo em Todas as Doses!");
    respostaJson += ",\"status\":\"sucesso_dispensado\"}";
  } else {
    // Dispara sinalizador de Erro Mecânico para travar a tela do Site (Item f)
    respostaJson += ",\"status\":\"falha_sensor_ir\"}";
  }

  if (client.connected()) {
     client.publish(topicoConfirmacao, respostaJson.c_str());
  }

  digitalWrite(greenLed, HIGH);
}

void verificarHorarios() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return;

  int diaAtual = timeinfo.tm_wday + 1; // 1 = Domingo, 2 = Segunda...
  int horaAtual = timeinfo.tm_hour;
  int minutoAtual = timeinfo.tm_min;
  
  Serial.printf("Relógio ESP32 -> Dia: %d | Hora atual: %02d:%02d\n", diaAtual, horaAtual, minutoAtual);
  
  for (int i = 0; i < totalAgendamentos; i++) {
    if (agenda[i].dia == diaAtual && agenda[i].hora == horaAtual && agenda[i].minuto == minutoAtual) {
      
      // Aciona o motor passando os parâmetros de doses dinâmicas configurados
      dispensarRemedio(agenda[i].slot, agenda[i].idMensagem, agenda[i].dose);
      
      // Remove de forma segura o registro processado da memória volátil interna
      for (int j = i; j < totalAgendamentos - 1; j++) {
        agenda[j] = agenda[j + 1];
      }
      totalAgendamentos--;
      i--; 
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  pinMode(greenLed, OUTPUT);
  pinMode(pinoIR, INPUT);
  digitalWrite(greenLed, HIGH);

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  meuServo.setPeriodHertz(50);
  meuServo.attach(pinoServo, 500, 2400);
  meuServo.write(180);

  motor.setSpeed(15);

  conectarWiFi();
  conectarNTP();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  carregarAgendaFlash();
  Serial.println("Sistema Pronto e Configurado para Múltiplas Doses!");
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  if (millis() - ultimoTempoVerificacao >= intervaloVerificacao) {
    ultimoTempoVerificacao = millis();
    verificarHorarios();
  }
}
