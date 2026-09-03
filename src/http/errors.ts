/**
 * Erros de aplicacao com o status HTTP embutido. As camadas de dentro lancam,
 * o middleware de erro traduz para JSON, e nenhum service precisa conhecer o
 * objeto de resposta do Express.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'recurso nao encontrado') {
    super(404, 'not_found', message)
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'bad_request', message, details)
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown, message = 'corpo da requisicao invalido') {
    super(400, 'validation_error', message, details)
  }
}
