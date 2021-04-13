#include <iostream>
#include <string>
#include <napi.h>
#include "./native.hpp"
#include "./utils.hpp"

class ReplaceInFileWorker : public Napi::AsyncWorker {
    public:
        ReplaceInFileWorker(Napi::Env &env, Napi::Promise::Deferred deferred, const char *filePath, const char *from, const char *to)
        :AsyncWorker(env), deferred(deferred), filePath(strdup(filePath)), from(strdup(from)), to(strdup(to)) {}
        ~ReplaceInFileWorker() {
            if (this->filePath) {
                free(this->filePath);
            }

            if (this->from) {
                free(this->from);
            }

            if (this->to) {
                free(this->to);
            }
        }

    void Execute() override {
        if (this->filePath && this->from && this->to) {

        }
    }

    void OnOK() override {
        Napi::Env env = Env();
        this->deferred.Resolve(Napi::Boolean::New(env, true));
    }

    private:
        Napi::Promise::Deferred deferred;
        char *filePath;
        char *from;
        char *to;
};

Napi::Promise replaceInFileAsync(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    std::string filePath = info[0].As<Napi::String>().Utf8Value();
    std::string from = info[1].As<Napi::String>().Utf8Value();
    std::string to = info[2].As<Napi::String>().Utf8Value();
    Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);

    ReplaceInFileWorker *worker = new ReplaceInFileWorker(env, deferred, filePath.c_str(), from.c_str(), to.c_str());
    worker->Queue();
    return deferred.Promise();
}
